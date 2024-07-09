import os
import re
from fuzzywuzzy import fuzz
from models import db, Site, Scene

def parser_config_to_regex(tokens: str):
    _sep = r'[\.\- ]+'
    _site = r'(?P<site>.*?)'
    _date = r'(?P<year>[0-9]{2}(?:[0-9]{2})?)[\.\- ]+(?P<month>[0-9]{2})[\.\- ]+(?P<day>[0-9]{2})'
    _optional_date = r'(?:(?P<year>[0-9]{2}(?:[0-9]{2})?)[\.\- ]+(?P<month>[0-9]{2})[\.\- ]+(?P<day>[0-9]{2})[\.\- ]+)?'
    _ts = r'((?P<trans>[T|t][S|s])' + _sep + '){0,1}'
    _name = r'(?P<name>(?:.(?![0-9]{2,4}[\.\- ][0-9]{2}[\.\- ][0-9]{2}))*)'
    _dot = r'\.'
    _ext = r'(?P<ext>[a-zA-Z0-9]{3,4})$'
    regex = tokens.format_map({
        '_site': _site,
        '_date': _date,
        '_optional_date': _optional_date,
        '_ts': _ts,
        '_name': _name,
        '_ext': _ext,
        '_sep': _sep,
        '_dot': _dot,
    })
    return re.compile(regex)

def compare_directory_with_db(directory):
    scenes = Scene.query.all()
    db_filenames = set()
    for scene in scenes:
        filename = f"{scene.site.name} - {scene.title} - {scene.date}.mp4"
        db_filenames.add(filename)

    local_filenames = set(os.listdir(directory))
    missing_files = db_filenames - local_filenames
    extra_files = local_filenames - db_filenames

    regex = parser_config_to_regex("{_site}{_sep}{_optional_date}{_ts}{_name}{_dot}{_ext}")
    matched_filenames = set()

    for filename in local_filenames:
        match = regex.match(filename)
        if match:
            match_dict = match.groupdict()
            for db_filename in db_filenames:
                db_match = regex.match(db_filename)
                if db_match:
                    db_match_dict = db_match.groupdict()
                    if fuzz.ratio(match_dict['site'], db_match_dict['site']) > 95 and \
                       fuzz.ratio(match_dict['name'], db_match_dict['name']) > 95 and \
                       fuzz.ratio(match_dict['year'] + match_dict['month'] + match_dict['day'],
                                  db_match_dict['year'] + db_match_dict['month'] + db_match_dict['day']) > 95:
                        matched_filenames.add(filename)
                        break

    missing_files -= matched_filenames
    extra_files -= matched_filenames

    return missing_files, extra_files

def update_comparison_results(site_uuid, missing_files, extra_files):
    site = Site.query.filter_by(uuid=site_uuid).first()
    if not site:
        return {'error': 'Site not found'}

    for scene in Scene.query.filter_by(site_id=site.id).all():
        filename = f"{site.name} - {scene.title} - {scene.date}.mp4"
        if filename in missing_files:
            scene.status = 'Missing'
        elif filename in extra_files:
            scene.status = 'Found'
        else:
            scene.status = 'Unknown'
    db.session.commit()

    return {'message': 'Comparison results updated'}
