from stashAid import app
import logging
from logging.handlers import RotatingFileHandler

def setup_logging():
    """Set up the app's logging."""
    handler = RotatingFileHandler('stashAid.log', maxBytes=10000, backupCount=1)
    handler.setLevel(logging.INFO)
    app.logger.addHandler(handler)

def run():
    setup_logging()
    # Optional: Configure the log level and start the Flask app with more detailed output
    app.logger.setLevel(logging.INFO)
    app.logger.info('Starting stashAid Flask application...')
    # Consider adding host='0.0.0.0' if you want your app to be accessible on your network
    app.run(port=5123, debug=True)  # Be cautious with debug=True in production environments

if __name__ == '__main__':
    run()
