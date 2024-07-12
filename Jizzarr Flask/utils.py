import re
import os
from fuzzywuzzy import fuzz
from mutagen.mp4 import MP4

def get_file_duration(file_path):
    try:
        file_extension = os.path.splitext(file_path)[1].lower()
        if file_extension == '.mp4':
            audio = MP4(file_path)
            return audio.info.length / 60  # convert seconds to minutes
    except Exception as e:
        logging.error(f"Error getting duration for file {file_path}: {e}")
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
                    'suggested_file_title': filename.stem,
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
                        match_data['suggested_file_performers'] = filename.stem
                        match_data['performers_score'] = fuzz.partial_ratio(clean_filename, clean_scene_performers)
                potential_matches.append(match_data)
    return potential_matches

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
                logging.error(f"Error deleting scene {duplicate.id}: {e}")
        else:
            seen_guids.add(duplicate.foreign_guid)

    db.session.commit()

    logging.info(f"Deleted {len(deleted_scenes)} duplicate scenes")
    for scene in deleted_scenes:
        logging.info(f"Deleted scene ID: {scene['id']}, Title: {scene['title']}, Site ID: {scene['site_id']}, Foreign GUID: {scene['foreign_guid']}, Local Path: {scene['local_path']}, Size: {scene['size']} bytes")

    total_size_mb = total_size_saved / (1024 * 1024)
    logging.info(f"Total space saved: {total_size_mb:.2f} MB")
