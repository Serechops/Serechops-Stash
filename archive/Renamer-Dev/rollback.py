import json
from pathlib import Path
import shutil

def read_log_file(log_path):
    log_entries = []
    with open(log_path, 'r') as file:
        for line in file:
            try:
                # Parse the JSON object from each line directly
                entry = json.loads(line.strip())
                log_entries.append(entry)
            except json.JSONDecodeError as e:
                print(f"Error decoding JSON from line: {line}. Error: {e}")
    return log_entries

def filter_entries_by_scene_id(entries, scene_id):
    filtered = [entry for entry in entries if entry.get('scene_id') == scene_id]
    return filtered

def display_options(entries):
    print("Available rollback options for the selected scene:")
    for idx, entry in enumerate(entries, start=1):
        print(f"{idx}. {entry['asctime']}: Move '{entry['new_path']}' back to '{entry['original_path']}'")
    return entries

def perform_rollback(entries, choice):
    selected_entry = entries[choice - 1]  # Adjust index for zero-based list
    try:
        # Move or rename back to the original path
        shutil.move(selected_entry['new_path'], selected_entry['original_path'])
        print(f"Rollback successful: {selected_entry['new_path']} -> {selected_entry['original_path']}")
    except Exception as e:
        print(f"Error during rollback: {e}")

def main():
    log_path = Path(__file__).resolve().parent / "renamer.json"
    scene_id = input("Enter the scene ID for rollback: ")
    entries = read_log_file(log_path)
    filtered_entries = filter_entries_by_scene_id(entries, scene_id)
    
    if not filtered_entries:
        print("No entries found for the given scene ID.")
        return

    options = display_options(filtered_entries)
    if options:
        choice = int(input("Select an option to rollback (number): "))
        perform_rollback(options, choice)

if __name__ == '__main__':
    main()
