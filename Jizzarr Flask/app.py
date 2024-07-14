import os
import re
import json
import mimetypes
from fuzzywuzzy import fuzz
from mutagen.mp4 import MP4
from pathlib import Path
from flask import Flask, request, jsonify, render_template, send_file
from flask_cors import CORS
from models import db, Site, Scene, Config, Log
from PIL import Image
import imagehash
import requests
import uuid
from sqlalchemy import func
import datetime
import logging
from contextlib import contextmanager
from sqlalchemy.exc import SQLAlchemyError

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///jizzarr.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

config = {
    'stashEndpoint': '',
    'stashApiKey': '',
    'tpdbApiKey': ''
}

# Enable CORS for the app
CORS(app)

# Create tables before the first request
with app.app_context():
    db.create_all()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/config_page')
def config_page():
    stash_endpoint = Config.query.filter_by(key='stashEndpoint').first()
    stash_api_key = Config.query.filter_by(key='stashApiKey').first()
    tpdb_api_key = Config.query.filter_by(key='tpdbApiKey').first()

    return render_template('config.html', 
                           stash_endpoint=stash_endpoint.value if stash_endpoint else '',
                           stash_api_key=stash_api_key.value if stash_api_key else '',
                           tpdb_api_key=tpdb_api_key.value if tpdb_api_key else '')

@app.route('/save_config', methods=['POST'])
def save_config():
    try:
        config_data = request.json
        for key, value in config_data.items():
            config = Config.query.filter_by(key=key).first()
            if config:
                config.value = value
            else:
                config = Config(key=key, value=value)
                db.session.add(config)
        db.session.commit()
        log_entry('INFO', 'Configuration saved successfully')
        return jsonify({"message": "Configuration saved successfully"})
    except Exception as e:
        log_entry('ERROR', f"Error saving configuration: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/get_tpdb_api_key', methods=['GET'])
def get_tpdb_api_key():
    try:
        tpdb_api_key = Config.query.filter_by(key='tpdbApiKey').first()
        if tpdb_api_key:
            return jsonify({'tpdbApiKey': tpdb_api_key.value})
        else:
            log_entry('ERROR', 'TPDB API Key not found')
            return jsonify({'error': 'TPDB API Key not found'}), 404
    except Exception as e:
        log_entry('ERROR', f"Error retrieving TPDB API Key: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/collection')
def collection():
    return render_template('collection.html')

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

@app.route('/collection_data', methods=['GET'])
def collection_data():
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 12))
        logger.debug(f"Fetching sites for page {page} with {per_page} items per page")

        # Correct usage of paginate
        sites_paginate = Site.query.paginate(page=page, per_page=per_page, error_out=False)
        collection_data = []
        delete_duplicate_scenes()

        for site in sites_paginate.items:
            logger.debug(f"Processing site: {site.name}")
            scenes = Scene.query.filter_by(site_id=site.id).all()
            total_scenes = len(scenes)
            collected_scenes = len([scene for scene in scenes if scene.status == 'Found'])
            scene_list = []
            for scene in scenes:
                scene_list.append({
                    'id': scene.id,
                    'title': scene.title,
                    'date': scene.date,
                    'duration': scene.duration,
                    'image': scene.image,
                    'performers': scene.performers,
                    'status': scene.status or 'Missing',
                    'local_path': scene.local_path,
                    'year': scene.year,
                    'episode_number': scene.episode_number,
                    'slug': scene.slug,
                    'overview': scene.overview,
                    'credits': scene.credits,
                    'release_date_utc': scene.release_date_utc,
                    'images': scene.images,
                    'trailer': scene.trailer,
                    'genres': scene.genres,
                    'foreign_guid': scene.foreign_guid,
                    'foreign_id': scene.foreign_id,
                    'url': scene.url  # Ensure this field is included
                })
            collection_data.append({
                'site': {
                    'uuid': site.uuid,
                    'name': site.name,
                    'url': site.url,
                    'description': site.description,
                    'rating': site.rating,
                    'network': site.network,
                    'parent': site.parent,
                    'logo': site.logo,
                    'home_directory': site.home_directory
                },
                'scenes': scene_list,
                'total_scenes': total_scenes,
                'collected_scenes': collected_scenes
            })

        response = {
            'collection_data': collection_data,
            'total_pages': sites_paginate.pages,
            'current_page': sites_paginate.page
        }

        logger.info('Collection data retrieved successfully')
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error retrieving collection data: {e}")
        return jsonify({"error": str(e)}), 500

from contextlib import contextmanager
from sqlalchemy.exc import SQLAlchemyError

@contextmanager
def session_scope():
    """Provide a transactional scope around a series of operations."""
    session = db.session
    try:
        yield session
        session.commit()
    except SQLAlchemyError as e:
        session.rollback()
        logger.error(f"Session rollback because of exception: {e}")
        raise
    finally:
        session.close()



@app.route('/add_site', methods=['POST'])
def add_site():
    data = request.json
    site_uuid = data['site']['uuid']

    rating = data['site']['rating']
    if rating == '':
        rating = None
    else:
        try:
            rating = float(rating)
        except ValueError:
            rating = None

    with session_scope() as session:
        try:
            existing_site = session.query(Site).filter_by(uuid=site_uuid).first()

            if existing_site:
                existing_site.name = data['site']['name']
                existing_site.url = data['site']['url']
                existing_site.description = data['site']['description']
                existing_site.rating = rating
                existing_site.network = data['site']['network']
                existing_site.parent = data['site']['parent']
                existing_site.logo = data['site'].get('logo', '')

                session.query(Scene).filter_by(site_id=existing_site.id).delete()
                scenes = []
                for scene_data in data['scenes']:
                    title = scene_data.get('title')
                    if not title:
                        continue

                    performers = ', '.join([performer['Name'] for performer in scene_data['performers']]) if isinstance(scene_data['performers'], list) else scene_data['performers']

                    if not session.query(Scene).filter_by(foreign_guid=scene_data['foreign_guid']).first():
                        scene = Scene(
                            site_id=existing_site.id,
                            title=scene_data['title'],
                            date=scene_data['date'],
                            duration=scene_data['duration'],
                            image=scene_data['image'],
                            performers=performers,
                            status=scene_data.get('status'),
                            local_path=scene_data.get('local_path'),
                            year=scene_data.get('year'),
                            episode_number=scene_data.get('episode_number'),
                            slug=scene_data.get('slug'),
                            overview=scene_data.get('overview'),
                            credits=scene_data.get('credits'),
                            release_date_utc=scene_data.get('release_date_utc'),
                            images=scene_data.get('images'),
                            trailer=scene_data.get('trailer'),
                            genres=scene_data.get('genres'),
                            foreign_guid=scene_data.get('foreign_guid'),
                            foreign_id=scene_data.get('foreign_id')
                        )
                        scenes.append(scene)
                session.bulk_save_objects(scenes)
                log_entry('INFO', f'Site and scenes updated successfully for site UUID: {site_uuid}')
                return jsonify({'message': 'Site and scenes updated successfully!'}), 200
            else:
                site = Site(
                    uuid=site_uuid,
                    name=data['site']['name'],
                    url=data['site']['url'],
                    description=data['site']['description'],
                    rating=rating,
                    network=data['site']['network'],
                    parent=data['site']['parent'],
                    logo=data['site'].get('logo', '')
                )
                session.add(site)
                session.commit()  # Ensure site is committed before adding scenes

                scenes = []
                for scene_data in data['scenes']:
                    title = scene_data.get('title')
                    if not title:
                        continue

                    performers = ', '.join([performer['Name'] for performer in scene_data['performers']]) if isinstance(scene_data['performers'], list) else scene_data['performers']

                    if not session.query(Scene).filter_by(foreign_guid=scene_data['foreign_guid']).first():
                        scene = Scene(
                            site_id=site.id,
                            title=scene_data['title'],
                            date=scene_data['date'],
                            duration=scene_data['duration'],
                            image=scene_data['image'],
                            performers=performers,
                            status=scene_data.get('status'),
                            local_path=scene_data.get('local_path'),
                            year=scene_data.get('year'),
                            episode_number=scene_data.get('episode_number'),
                            slug=scene_data.get('slug'),
                            overview=scene_data.get('overview'),
                            credits=scene_data.get('credits'),
                            release_date_utc=scene_data.get('release_date_utc'),
                            images=scene_data.get('images'),
                            trailer=scene_data.get('trailer'),
                            genres=scene_data.get('genres'),
                            foreign_guid=scene_data.get('foreign_guid'),
                            foreign_id=scene_data.get('foreign_id')
                        )
                        scenes.append(scene)
                session.bulk_save_objects(scenes)
                log_entry('INFO', f'Site and scenes added successfully for site UUID: {site_uuid}')
                return jsonify({'message': 'Site and scenes added successfully!'}), 201
        except SQLAlchemyError as e:
            log_entry('ERROR', f"Database error occurred: {e}")
            return jsonify({'error': 'Database error occurred'}), 500


from sqlalchemy.sql import text

@app.route('/remove_site/<string:site_uuid>', methods=['DELETE'])
def remove_site(site_uuid):
    try:
        site = Site.query.filter_by(uuid=site_uuid).first()
        if not site:
            log_entry('ERROR', f'Site not found for UUID: {site_uuid}')
            return jsonify({'error': 'Site not found'}), 404

        # Fetch all scenes associated with the site
        scenes = Scene.query.filter_by(site_id=site.id).all()
        scene_count = len(scenes)

        # Calculate total database size before deletion
        total_size_before = db.session.execute(text("PRAGMA page_count")).fetchone()[0] * db.session.execute(text("PRAGMA page_size")).fetchone()[0]

        # Delete the scenes
        for scene in scenes:
            db.session.delete(scene)
        db.session.commit()
        
        # Delete the site
        db.session.delete(site)
        db.session.commit()

        # Calculate space saved
        total_size_after = db.session.execute(text("PRAGMA page_count")).fetchone()[0] * db.session.execute(text("PRAGMA page_size")).fetchone()[0]
        space_saved = total_size_before - total_size_after

        log_entry('INFO', f'Removed site: {site.name} with UUID: {site_uuid}')
        log_entry('INFO', f'Removed {scene_count} scenes associated with the site')
        log_entry('INFO', f'Space saved: {space_saved} bytes')

        return jsonify({'message': 'Site and scenes removed successfully!', 'space_saved': space_saved}), 200
    except Exception as e:
        log_entry('ERROR', f"Error removing site: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/remove_scene/<int:scene_id>', methods=['DELETE'])
def remove_scene(scene_id):
    try:
        scene = db.session.get(Scene, scene_id)
        if not scene:
            log_entry('ERROR', f'Scene not found for ID: {scene_id}')
            return jsonify({'error': 'Scene not found'}), 404

        db.session.delete(scene)
        db.session.commit()

        log_entry('INFO', f'Scene removed successfully for ID: {scene_id}')
        return jsonify({'message': 'Scene removed successfully!'})
    except Exception as e:
        log_entry('ERROR', f"Error removing scene: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/match_scene', methods=['POST'])
def match_scene():
    data = request.json
    scene_id = data.get('scene_id')
    file_path = data.get('file_path')

    scene = db.session.get(Scene, scene_id)
    if not scene:
        log_entry('ERROR', f'Scene not found for ID: {scene_id}')
        return jsonify({'error': 'Scene not found'}), 404

    # Update scene with new file path
    scene.local_path = file_path
    scene.status = 'Found'
    db.session.commit()

    log_entry('INFO', f'Scene matched successfully for ID: {scene_id} with file path: {file_path}')
    return jsonify({'message': 'Scene matched successfully!', 'new_file_path': file_path})

@app.route('/set_home_directory', methods=['POST'])
def set_home_directory():
    data = request.json
    site_uuid = data.get('site_uuid')
    directory = data.get('directory')

    site = Site.query.filter_by(uuid=site_uuid).first()
    if not site:
        log_entry('ERROR', f'Site not found for UUID: {site_uuid}')
        return jsonify({'error': 'Site not found'}), 404

    site.home_directory = directory
    db.session.commit()

    log_entry('INFO', f'Home directory set successfully for site UUID: {site_uuid}')
    return jsonify({'message': 'Home directory set successfully!'})

from moviepy.editor import VideoFileClip
import os

def get_file_duration(file_path):
    try:
        file_extension = os.path.splitext(file_path)[1].lower()
        if file_extension in ['.mp4', '.avi', '.mov', '.mkv', '.flv', '.wmv', '.webm']:
            video = VideoFileClip(file_path)
            return video.duration / 60  # convert seconds to minutes
        else:
            print(f"Unsupported file format for file {file_path}")
    except Exception as e:
        print(f"Error getting duration for file {file_path}: {e}")
    return None

def clean_string(input_string):
    if isinstance(input_string, list):
        return ' '.join([re.sub(r'[^\w\s]', '', performer).lower() for performer in input_string])
    return re.sub(r'[^\w\s]', '', input_string).lower()

def extract_date_from_filename(filename):
    date_patterns = [
        r'(\d{4}-\d{2}-\d{2})',  # YYYY-MM-DD
        r'(\d{2}-\d{2}-\d{4})',  # DD-MM-YYYY
        r'(\d{2}-\d{2}-\d{2})',  # DD-MM-YY
    ]
    for pattern in date_patterns:
        match = re.search(pattern, filename)
        if match:
            return match.group(1)
    return None

def get_potential_matches(scenes, filenames, tolerance=95):
    potential_matches = []
    for scene in scenes:
        for filename in filenames:
            clean_filename = clean_string(str(filename))
            clean_scene_title = clean_string(scene['title'])
            if fuzz.partial_ratio(clean_filename, clean_scene_title) >= tolerance:
                match_data = {
                    'scene_id': scene['id'],
                    'suggested_file': str(filename),
                    'suggested_file_title': filename.stem,  # Example, you can adjust as needed
                    'title_score': fuzz.partial_ratio(clean_filename, clean_scene_title),
                }
                if 'date' in scene and scene['date']:
                    clean_scene_date = clean_string(scene['date'])
                    filename_date = extract_date_from_filename(clean_filename)
                    if filename_date and clean_string(filename_date) == clean_scene_date:
                        match_data['suggested_file_date'] = filename_date
                        match_data['date_score'] = 100

                if 'duration' in scene and scene['duration']:
                    file_duration = get_file_duration(str(filename))
                    if file_duration and abs(file_duration - scene['duration']) < 1:  # tolerance of 1 minute
                        match_data['suggested_file_duration'] = file_duration
                        match_data['duration_score'] = 100

                if 'performers' in scene and scene['performers']:
                    clean_scene_performers = clean_string(scene['performers'])
                    if fuzz.partial_ratio(clean_filename, clean_scene_performers) >= tolerance:
                        match_data['suggested_file_performers'] = filename.stem  # Example, adjust as needed
                        match_data['performers_score'] = fuzz.partial_ratio(clean_filename, clean_scene_performers)
                potential_matches.append(match_data)
    return potential_matches

@app.route('/suggest_matches', methods=['POST'])
def suggest_matches():
    try:
        data = request.json
        site_uuid = data.get('site_uuid')
        tolerance = data.get('tolerance', 95)

        site = Site.query.filter_by(uuid=site_uuid).first()
        if not site or not site.home_directory:
            log_entry('ERROR', f'Site or home directory not found for UUID: {site_uuid}')
            return jsonify({'error': 'Site or home directory not found'}), 404

        scenes = Scene.query.filter_by(site_id=site.id).all()
        scene_data = [{'id': scene.id, 'title': scene.title, 'date': scene.date, 'duration': scene.duration, 'performers': scene.performers} for scene in scenes]

        home_directory = Path(site.home_directory)
        filenames = [f for f in home_directory.glob('**/*') if f.is_file() and mimetypes.guess_type(f)[0] and mimetypes.guess_type(f)[0].startswith('video/')]

        potential_matches = get_potential_matches(scene_data, filenames, tolerance)
        log_entry('INFO', f'Potential matches suggested for site UUID: {site_uuid}')
        return jsonify(potential_matches)
    except Exception as e:
        log_entry('ERROR', f"Error suggesting matches: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/search_stash_for_matches', methods=['POST'])
def search_stash_for_matches():
    try:
        data = request.json
        site_uuid = data.get('site_uuid')

        if not site_uuid:
            log_entry('ERROR', 'Site UUID is required for search_stash_for_matches')
            return jsonify({'error': 'Site UUID is required'}), 400

        site = Site.query.filter_by(uuid=site_uuid).first()
        if not site:
            log_entry('ERROR', f'Site not found for UUID: {site_uuid}')
            return jsonify({'error': 'Site not found'}), 404

        scenes = Scene.query.filter_by(site_id=site.id).all()
        stash_matches = []

        stash_endpoint = Config.query.filter_by(key='stashEndpoint').first()
        stash_api_key = Config.query.filter_by(key='stashApiKey').first()

        if not stash_endpoint or not stash_api_key:
            log_entry('ERROR', 'Stash endpoint or API key not configured')
            return jsonify({'error': 'Stash endpoint or API key not configured'}), 500

        local_endpoint = stash_endpoint.value
        local_headers = {
            "Accept-Encoding": "gzip, deflate, br",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": f"Apikey {stash_api_key.value}"
        }

        for scene in scenes:
            foreign_guid = scene.foreign_guid
            if not foreign_guid:
                continue

            query = {
                "query": f"""
                    query FindScenes {{
                        findScenes(
                            scene_filter: {{
                                stash_id_endpoint: {{
                                    stash_id: "{foreign_guid}"
                                    modifier: EQUALS
                                }}
                            }}
                        ) {{
                            scenes {{
                                id
                                title
                                files {{
                                    path
                                }}
                            }}
                        }}
                    }}
                """
            }

            try:
                response = requests.post(local_endpoint, json=query, headers=local_headers)
            except requests.exceptions.RequestException as e:
                log_entry('ERROR', f'Error fetching data from Stash: {e}')
                continue

            if response.status_code != 200:
                log_entry('ERROR', f'Failed to fetch data from Stash for scene ID: {scene.id}')
                continue

            result = response.json()
            matched_scenes = result['data']['findScenes']['scenes']

            if matched_scenes:
                matched_scene = matched_scenes[0]
                stash_matches.append({
                    'scene_id': scene.id,
                    'matched_scene_id': matched_scene['id'],
                    'matched_title': matched_scene['title'],
                    'matched_file_path': matched_scene['files'][0]['path'],
                    'foreign_guid': foreign_guid,
                    'scene_title': scene.title,
                    'scene_date': scene.date,
                    'scene_duration': scene.duration,
                    'scene_performers': scene.performers,
                    'scene_status': scene.status,
                    'scene_local_path': scene.local_path
                })

        log_entry('INFO', f'Stash matches searched successfully for site UUID: {site_uuid}')
        return jsonify(stash_matches)
    except Exception as e:
        log_entry('ERROR', f"Error searching stash for matches: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/get_site_uuid', methods=['POST'])
def get_site_uuid():
    data = request.json
    site_title = data.get('site_title')

    if not site_title:
        log_entry('ERROR', 'Site title is required for get_site_uuid')
        return jsonify({'error': 'Site title is required'}), 400

    site = Site.query.filter_by(name=site_title).first()
    if not site:
        log_entry('ERROR', f'Site not found for title: {site_title}')
        return jsonify({'error': 'Site not found'}), 404

    log_entry('INFO', f'Site UUID retrieved successfully for title: {site_title}')
    return jsonify({'site_uuid': site.uuid})

@app.route('/collection_stats', methods=['GET'])
def collection_stats():
    total_scenes = Scene.query.count()
    collected_scenes = Scene.query.filter(Scene.status == 'Found', Scene.local_path.isnot(None)).count()
    
    stats = {
        'total': total_scenes,
        'collected': collected_scenes
    }
    log_entry('INFO', 'Collection stats retrieved successfully')
    return jsonify(stats)

import logging
import time
import threading
from flask import Flask, jsonify, request, Response, stream_with_context
from sqlalchemy.exc import OperationalError
from sqlalchemy.sql import text
import requests
import json

# Set up basic logging
logging.basicConfig(level=logging.INFO)

# Set SQLite busy timeout
@app.before_request
def before_request():
    if 'sqlite' in app.config['SQLALCHEMY_DATABASE_URI']:
        db.session.execute(text('PRAGMA busy_timeout = 30000'))  # 30 seconds

# Variable to store progress
progress = {"total": 0, "completed": 0}

import time

@app.route('/progress')
def get_progress():
    def generate():
        while True:
            data = json.dumps(progress)
            yield f"data: {data}\n\n"
            time.sleep(1)
    
    return Response(generate(), mimetype='text/event-stream')

import threading
import time
from flask import current_app
from threading import Thread

# Variable to store progress
progress = {"total": 0, "completed": 0}

def populate_from_stash_thread():
    with app.app_context():
        try:
            stash_endpoint = Config.query.filter_by(key='stashEndpoint').first()
            stash_api_key = Config.query.filter_by(key='stashApiKey').first()
            tpdb_api_key = Config.query.filter_by(key='tpdbApiKey').first()

            if not stash_endpoint or not stash_api_key or not tpdb_api_key:
                log_entry('ERROR', 'Stash endpoint, Stash API key, or TPDB API key not configured')
                return

            log_entry('INFO', 'Fetching scenes from Stash')
            query = """
            query FindScenes {
                findScenes(
                    scene_filter: {
                        stash_id_endpoint: {
                            endpoint: "https://theporndb.net/graphql"
                            modifier: INCLUDES
                        }
                    },
                    filter: { per_page: -1, direction: ASC }
                ) {
                    scenes {
                        studio {
                            name
                        }
                    }
                }
            }
            """

            response = requests.post(stash_endpoint.value, json={'query': query}, headers={
                "Authorization": f"Apikey {stash_api_key.value}",
                "Content-Type": "application/json"
            })

            if response.status_code != 200:
                log_entry('ERROR', 'Failed to fetch data from Stash')
                return

            data = response.json()
            scenes = data.get('data', {}).get('findScenes', {}).get('scenes', [])

            if not scenes:
                log_entry('INFO', 'No scenes found from Stash')
                return

            studio_names = {scene['studio']['name'] for scene in scenes if scene.get('studio')}
            progress['total'] = len(studio_names)
            progress['completed'] = 0

            headers = {'Authorization': f'Bearer {tpdb_api_key.value}'}

            for studio_name in studio_names:
                log_entry('INFO', f'Searching for studio: {studio_name}')
                search_url = f"https://api.theporndb.net/jizzarr/site/search?q={studio_name}"
                try:
                    search_response = requests.get(search_url, headers=headers)
                except requests.RequestException as e:
                    log_entry('WARNING', f'Error fetching data for studio {studio_name}: {e}')
                    continue

                if search_response.status_code != 200:
                    log_entry('WARNING', f'Failed to fetch data for studio: {studio_name}')
                    continue

                search_results = search_response.json()
                for site_data in search_results:
                    with db.session.no_autoflush:
                        site = Site.query.filter_by(uuid=site_data['ForeignGuid']).first()
                        if site:
                            log_entry('INFO', f'Updating existing site: {site_data["Title"]}')
                            site.name = site_data['Title']
                            site.url = site_data['Homepage']
                            site.description = site_data['Overview']
                            site.network = site_data['Network']
                            site.logo = next((img['Url'] for img in site_data['Images'] if img['CoverType'] == 'Logo'), '')
                        else:
                            log_entry('INFO', f'Creating new site: {site_data["Title"]}')
                            site = Site(
                                uuid=site_data['ForeignGuid'],
                                name=site_data['Title'],
                                url=site_data['Homepage'],
                                description=site_data['Overview'],
                                rating=None,
                                network=site_data['Network'],
                                parent='',
                                logo=next((img['Url'] for img in site_data['Images'] if img['CoverType'] == 'Logo'), '')
                            )
                            db.session.add(site)
                        db.session.commit()

                    scenes_data = fetch_scenes_data(site_data['ForeignId'], headers)
                    if scenes_data:
                        scenes_added = 0
                        for scene_data in scenes_data:
                            with db.session.no_autoflush:
                                existing_scene = Scene.query.filter_by(foreign_guid=scene_data['ForeignGuid']).first()
                                if existing_scene:
                                    log_entry('INFO', f'Scene with ForeignGuid {scene_data["ForeignGuid"]} already exists. Skipping.')
                                    continue  # Skip adding this scene as it already exists

                                performers = ', '.join([performer['Name'] for performer in scene_data['Credits']])
                                scene = Scene(
                                    site_id=site.id,
                                    title=scene_data['Title'],
                                    date=scene_data['ReleaseDate'],
                                    duration=scene_data['Duration'],
                                    image=next((img['Url'] for img in scene_data['Images'] if img['CoverType'] == 'Screenshot'), ''),
                                    performers=performers,
                                    status=scene_data.get('Status', ''),
                                    local_path=scene_data.get('LocalPath', ''),
                                    year=scene_data.get('Year', 0),
                                    episode_number=scene_data.get('EpisodeNumber', 0),
                                    slug=scene_data.get('Slug', ''),
                                    overview=scene_data.get('Overview', ''),
                                    credits=json.dumps(scene_data.get('Credits', [])),
                                    release_date_utc=scene_data.get('ReleaseDateUtc', ''),
                                    images=json.dumps(scene_data.get('Images', [])),
                                    trailer=scene_data.get('Trailer', ''),
                                    genres=json.dumps(scene_data.get('Genres', [])),
                                    foreign_guid=scene_data.get('ForeignGuid', ''),
                                    foreign_id=scene_data.get('ForeignId', 0)
                                )
                                db.session.add(scene)
                                scenes_added += 1
                        db.session.commit()
                        log_entry('INFO', f'Added {scenes_added} scenes for site: {site_data["Title"]}')
                
                # Update progress
                progress['completed'] += 1
                log_entry('INFO', f'Progress: {progress["completed"]}/{progress["total"]}')

            delete_duplicate_scenes()  # Call the function here to delete duplicates and log space saved

            log_entry('INFO', 'Sites and scenes populated from Stash')
        except Exception as e:
            log_entry('ERROR', f"Error populating from stash: {e}")

@app.route('/populate_from_stash', methods=['POST'])
def populate_from_stash():
    thread = Thread(target=populate_from_stash_thread)
    thread.start()
    return jsonify({'message': 'Stash population started'}), 202


def fetch_scenes_data(foreign_id, headers):
    url = f"https://api.theporndb.net/jizzarr/site/{foreign_id}"
    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        site_data = response.json()
        return site_data.get('Episodes', [])
    return []

def fetch_scenes_data(foreign_id, headers):
    url = f"https://api.theporndb.net/jizzarr/site/{foreign_id}"
    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        site_data = response.json()
        return site_data.get('Episodes', [])
    return []

import logging
from sqlalchemy.sql import func

def delete_duplicate_scenes():
    subquery = db.session.query(
        Scene.foreign_guid, func.count(Scene.id).label('count')
    ).group_by(Scene.foreign_guid).having(func.count(Scene.id) > 1).subquery()

    duplicates = db.session.query(Scene).join(subquery, Scene.foreign_guid == subquery.c.foreign_guid).all()

    total_size_saved = 0
    deleted_scenes = []

    seen_guids = set()

    for duplicate in duplicates:
        if duplicate.foreign_guid in seen_guids:
            try:
                scene_size = os.path.getsize(duplicate.local_path) if duplicate.local_path else 0
                total_size_saved += scene_size
                deleted_scenes.append({
                    'id': duplicate.id,
                    'title': duplicate.title,
                    'site_id': duplicate.site_id,
                    'foreign_guid': duplicate.foreign_guid,
                    'local_path': duplicate.local_path,
                    'size': scene_size
                })
                db.session.delete(duplicate)
            except Exception as e:
                log_entry('ERROR', f"Error deleting scene {duplicate.id}: {e}")
        else:
            seen_guids.add(duplicate.foreign_guid)

    db.session.commit()

    log_entry('INFO', f"Deleted {len(deleted_scenes)} duplicate scenes")
    for scene in deleted_scenes:
        log_entry('INFO', f"Deleted scene ID: {scene['id']}, Title: {scene['title']}, Site ID: {scene['site_id']}, Foreign GUID: {scene['foreign_guid']}, Local Path: {scene['local_path']}, Size: {scene['size']} bytes")

    total_size_mb = total_size_saved / (1024 * 1024)
    log_entry('INFO', f"Total space saved: {total_size_mb:.2f} MB")

# Add log entries
def log_entry(level, message):
    log = Log(level=level, message=message)
    db.session.add(log)
    db.session.commit()

@app.route('/logs')
def logs():
    logs = Log.query.order_by(Log.timestamp.desc()).all()
    log_entries = []
    for log in logs:
        log_entries.append({
            'level': log.level,
            'message': log.message,
            'timestamp': log.timestamp
        })
    return render_template('logs.html', logs=log_entries)

@app.route('/download_logs')
def download_logs():
    logs = Log.query.order_by(Log.timestamp.desc()).all()
    log_entries = []
    for log in logs:
        log_entries.append({
            'level': log.level,
            'message': log.message,
            'timestamp': log.timestamp.strftime("%Y-%m-%d %H:%M:%S")
        })
    logs_json = json.dumps(log_entries, indent=4)
    logs_file = 'logs.json'
    with open(logs_file, 'w') as f:
        f.write(logs_json)
    return send_file(logs_file, as_attachment=True)

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        delete_duplicate_scenes()
    app.run(debug=True, host='0.0.0.0', port=6900)
