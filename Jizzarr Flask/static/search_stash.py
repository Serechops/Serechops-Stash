import os
import json
import requests
from flask import Flask
from models import db, Site, Scene

def create_app():
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///jizzarr.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)
    return app

def get_scenes_for_site(site_uuid):
    app = create_app()
    with app.app_context():
        site = Site.query.filter_by(uuid=site_uuid).first()
        if not site:
            print(f'Site not found for UUID: {site_uuid}')
            return {'error': 'Site not found'}, 404

        print(f'Site found: {site.name}')

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

        return scene_list

def search_stash_for_matches(scenes):
    stash_endpoint = "http://192.168.1.54:9999/graphql"
    stash_headers = {
        "Accept-Encoding": "gzip, deflate, br",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }

    for scene in scenes:
        foreign_guid = scene.get('foreign_guid')
        if not foreign_guid:
            continue

        print(f'Searching Stash for ForeignGUID: {foreign_guid}')

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
            response = requests.post(stash_endpoint, json=query, headers=stash_headers)
            if response.status_code != 200:
                print(f'Error {response.status_code}: {response.text}')
                continue

            result = response.json()
            matched_scenes = result['data']['findScenes']['scenes']

            if matched_scenes:
                matched_scene = matched_scenes[0]  # Assuming first match is the desired one
                title = matched_scene['title']
                file_path = matched_scene['files'][0]['path'] if matched_scene['files'] else 'No file path'
                print(f'Match found for ForeignGUID {foreign_guid}: Title: {title}, File Path: {file_path}')

        except requests.exceptions.RequestException as e:
            print(f'Request failed: {e}')

if __name__ == "__main__":
    import sys
    if len(sys.argv) != 2:
        print("Usage: python get_scenes.py <site_uuid>")
        sys.exit(1)

    site_uuid = sys.argv[1]
    scenes = get_scenes_for_site(site_uuid)
    if isinstance(scenes, dict) and 'error' in scenes:
        print(scenes['error'])
    else:
        search_stash_for_matches(scenes)
