import shutil
import os
import datetime
import stashapi.log as log

def backup_plugins():
    # Get the absolute path of the directory containing the script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Get the absolute path of the parent directory
    parent_dir = os.path.abspath(os.path.join(script_dir, os.pardir))
    
    # Define the backup directory path (plugins.backup)
    backup_dir = os.path.abspath(os.path.join(parent_dir, '..', 'plugins.backup'))
    
    try:
        # If the backup directory already exists, append a timestamp to its name
        if os.path.exists(backup_dir):
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_dir += f"_{timestamp}"
        
        # Copy the entire parent directory to the backup directory
        shutil.copytree(parent_dir, backup_dir)
        
        # Log the successful backup
        log.info(f"Backup created successfully in {backup_dir}.")
    except Exception as e:
        # Log any errors that occur during the backup process
        log.error(f"Error: {e}")

if __name__ == "__main__":
    backup_plugins()
