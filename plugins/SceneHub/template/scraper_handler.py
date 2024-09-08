import subprocess
import time
import os
import stashapi.log as log

# Get the directory of the current script
script_dir = os.path.dirname(os.path.abspath(__file__))

# List of scrapers to run
scrapers = [
    'bang_scraper.py',
    'brazzers_scraper.py',
    'newsensations_scraper.py',
    'pornpros_scraper.py',
    'private_scraper.py',
    'realitykings_scraper.py',
    'vixen_scraper.py'
]

def run_scraper(scraper):
    """Run a scraper and log its progress."""
    try:
        log.info(f"Starting {scraper}...")
        start_time = time.time()

        # Run the scraper from the script's working directory
        scraper_path = os.path.join(script_dir, scraper)
        subprocess.run(['python', scraper_path], check=True)

        end_time = time.time()
        elapsed_time = end_time - start_time
        log.info(f"Completed {scraper} in {elapsed_time:.2f} seconds.")

    except subprocess.CalledProcessError as e:
        log.error(f"Error while running {scraper}: {e}")
    except Exception as e:
        log.error(f"Unexpected error with {scraper}: {e}")

def run_all_scrapers():
    """Run all scrapers sequentially and track overall progress."""
    total_scrapers = len(scrapers)

    for idx, scraper in enumerate(scrapers, 1):
        # Calculate progress as a value between 0 and 1
        progress_value = idx / total_scrapers
        log.progress(progress_value)
        
        log.info(f"Running scraper {idx}/{total_scrapers}: {scraper}")
        run_scraper(scraper)
        time.sleep(2)  # Optional: Sleep between scrapers to avoid overloading resources

    log.progress(1.0)  # Set progress to 100% when done
    log.info("All scrapers have completed successfully.")

if __name__ == "__main__":
    log.info("Scraper handler started.")
    run_all_scrapers()
    log.info("Scraper handler finished.")
