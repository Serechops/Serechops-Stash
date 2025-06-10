.PHONY: help install test build deploy-test deploy clean setup

help:
    @echo "Available commands:"
    @echo "  setup       - First-time PyPI setup"
    @echo "  install     - Install package in development mode"
    @echo "  test        - Run tests"
    @echo "  build       - Build package"
    @echo "  deploy-test - Deploy to TestPyPI"
    @echo "  deploy      - Deploy to PyPI"
    @echo "  clean       - Clean build artifacts"

setup:
    python setup_pypi.py

install:
    pip install -e .

test:
    python -m pytest tests/ -v

build:
    python -m build

deploy-test:
    python deploy.py --bump patch --test

deploy:
    python deploy.py --bump patch

clean:
    rm -rf build/ dist/ *.egg-info/