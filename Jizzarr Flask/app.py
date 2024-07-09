import os
import re
import json
import mimetypes
from fuzzywuzzy import fuzz
from mutagen.mp4 import MP4
from pathlib import Path
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from models import db, Site, Scene
from PIL import Image
import imagehash
import requests

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///jizzarr.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

# Enable CORS for the app
CORS(app)

# Create tables before the first request
with app.app_context():
    db.create_all()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/collection')
def collection():
    return render_template('collection.html')

@app.route('/collection_data', methods=['GET'])
def collection_data():
    sites = Site.query.all()
    collection = []
    for site in sites:
        scenes = Scene.query.filter_by(site_id=site.id).all()
        scene_list = []
        for scene in scenes:
            scene_list.append({
                'id': scene.id,
                'title': scene.title,
                'date': scene.date,
                'duration': scene.duration,
                'image': scene.image,
                'performers': scene.performers,
                'status': scene.status,
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
                'foreign_id': scene.foreign_id
            })
        collection.append({
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
            'scenes': scene_list
        })
    return jsonify(collection)

@app.route('/add_site', methods=['POST'])
def add_site():
    data = request.json
    site_uuid = data['site']['uuid']

    existing_site = Site.query.filter_by(uuid=site_uuid).first()

    rating = data['site']['rating']
    if rating == '':
        rating = None
    else:
        try:
            rating = float(rating)
        except ValueError:
            rating = None

    if existing_site:
        existing_site.name = data['site']['name']
        existing_site.url = data['site']['url']
        existing_site.description = data['site']['description']
        existing_site.rating = rating
        existing_site.network = data['site']['network']
        existing_site.parent = data['site']['parent']
        existing_site.logo = data['site'].get('logo', '')

        Scene.query.filter_by(site_id=existing_site.id).delete()
        scenes = []
        for scene_data in data['scenes']:
            print(f"Scene data keys: {scene_data.keys()}")  # Log scene data keys
            title = scene_data.get('title')
            if not title:
                print(f"Skipping scene due to missing title: {scene_data}")  # Log missing title
                continue

            performers = ', '.join([performer['Name'] for performer in scene_data['performers']]) if isinstance(scene_data['performers'], list) else scene_data['performers']

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
        db.session.bulk_save_objects(scenes)
        db.session.commit()

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
        db.session.add(site)
        db.session.commit()

        scenes = []
        for scene_data in data['scenes']:
            print(f"Scene data keys: {scene_data.keys()}")  # Log scene data keys
            title = scene_data.get('title')
            if not title:
                print(f"Skipping scene due to missing title: {scene_data}")  # Log missing title
                continue

            performers = ', '.join([performer['Name'] for performer in scene_data['performers']]) if isinstance(scene_data['performers'], list) else scene_data['performers']

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
        db.session.bulk_save_objects(scenes)
        db.session.commit()

        return jsonify({'message': 'Site and scenes added successfully!'}), 201

@app.route('/remove_site/<string:site_uuid>', methods=['DELETE'])
def remove_site(site_uuid):
    site = Site.query.filter_by(uuid=site_uuid).first()
    if not site:
        return jsonify({'error': 'Site not found'}), 404

    Scene.query.filter_by(site_id=site.id).delete()
    db.session.delete(site)
    db.session.commit()

    return jsonify({'message': 'Site and scenes removed successfully!'})

@app.route('/remove_scene/<int:scene_id>', methods=['DELETE'])
def remove_scene(scene_id):
    scene = db.session.get(Scene, scene_id)
    if not scene:
        return jsonify({'error': 'Scene not found'}), 404

    db.session.delete(scene)
    db.session.commit()

    return jsonify({'message': 'Scene removed successfully!'})

@app.route('/match_scene', methods=['POST'])
def match_scene():
    data = request.json
    scene_id = data.get('scene_id')
    file_path = data.get('file_path')

    scene = db.session.get(Scene, scene_id)
    if not scene:
        return jsonify({'error': 'Scene not found'}), 404

    # Update scene with new file path
    scene.local_path = file_path
    scene.status = 'Found'
    db.session.commit()
    return jsonify({'message': 'Scene matched successfully!', 'new_file_path': file_path})

@app.route('/set_home_directory', methods=['POST'])
def set_home_directory():
    data = request.json
    site_uuid = data.get('site_uuid')
    directory = data.get('directory')

    site = Site.query.filter_by(uuid=site_uuid).first()
    if not site:
        return jsonify({'error': 'Site not found'}), 404

    site.home_directory = directory
    db.session.commit()

    return jsonify({'message': 'Home directory set successfully!'})

def get_file_duration(file_path):
    try:
        file_extension = os.path.splitext(file_path)[1].lower()
        if file_extension == '.mp4':
            audio = MP4(file_path)
            return audio.info.length / 60  # convert seconds to minutes
        # Add more formats if necessary
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
    data = request.json
    site_uuid = data.get('site_uuid')
    tolerance = data.get('tolerance', 95)

    site = Site.query.filter_by(uuid=site_uuid).first()
    if not site or not site.home_directory:
        return jsonify({'error': 'Site or home directory not found'}), 404

    scenes = Scene.query.filter_by(site_id=site.id).all()
    scene_data = [{'id': scene.id, 'title': scene.title, 'date': scene.date, 'duration': scene.duration, 'performers': scene.performers} for scene in scenes]

    home_directory = Path(site.home_directory)
    filenames = [f for f in home_directory.glob('**/*') if f.is_file() and mimetypes.guess_type(f)[0] and mimetypes.guess_type(f)[0].startswith('video/')]

    potential_matches = get_potential_matches(scene_data, filenames, tolerance)
    return jsonify(potential_matches)

@app.route('/search_stash_for_matches', methods=['POST'])
def search_stash_for_matches_endpoint():
    data = request.json
    site_uuid = data.get('site_uuid')

    if not site_uuid:
        return jsonify({'error': 'Site UUID is required'}), 400

    site = Site.query.filter_by(uuid=site_uuid).first()
    if not site:
        return jsonify({'error': 'Site not found'}), 404

    scenes = Scene.query.filter_by(site_id=site.id).all()
    stash_matches = []

    local_endpoint = "http://localhost:9999/graphql"
    local_headers = {
        "Accept-Encoding": "gzip, deflate, br",
        "Content-Type": "application/json",
        "Accept": "application/json"
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
            continue

        if response.status_code != 200:
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
                'foreign_guid': foreign_guid
            })

    return jsonify(stash_matches)

@app.route('/get_site_uuid', methods=['POST'])
def get_site_uuid():
    data = request.json
    site_title = data.get('site_title')

    if not site_title:
        return jsonify({'error': 'Site title is required'}), 400

    site = Site.query.filter_by(name=site_title).first()
    if not site:
        return jsonify({'error': 'Site not found'}), 404

    return jsonify({'site_uuid': site.uuid})

@app.route('/collection_stats', methods=['GET'])
def collection_stats():
    total_scenes = Scene.query.count()
    collected_scenes = Scene.query.filter(Scene.local_path.isnot(None)).count()
    
    stats = {
        'total': total_scenes,
        'collected': collected_scenes
    }
    return jsonify(stats)


if __name__ == '__main__':
    app.run(debug=True)
