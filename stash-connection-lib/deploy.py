#!/usr/bin/env python3
"""
Deployment script for stash-connection-lib package.

Usage:
    python deploy.py --version 0.1.1 --test    # Deploy to TestPyPI
    python deploy.py --version 0.1.1           # Deploy to PyPI
    python deploy.py --bump patch              # Auto-bump patch version
    python deploy.py --bump minor              # Auto-bump minor version
    python deploy.py --bump major              # Auto-bump major version
"""

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path


def run_command(cmd: str, check: bool = True) -> subprocess.CompletedProcess:
    """Run a shell command and return the result."""
    print(f"🔧 Running: {cmd}")
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)

    if check and result.returncode != 0:
        print(f"❌ Command failed: {cmd}")
        print(f"Error: {result.stderr}")
        sys.exit(1)

    if result.stdout:
        print(f"✅ Output: {result.stdout.strip()}")

    return result


def get_current_version() -> str:
    """Extract current version from pyproject.toml."""
    pyproject_path = Path("pyproject.toml")
    if not pyproject_path.exists():
        print("❌ pyproject.toml not found!")
        sys.exit(1)

    content = pyproject_path.read_text()
    match = re.search(r'version\s*=\s*"([^"]+)"', content)
    if not match:
        print("❌ Version not found in pyproject.toml!")
        sys.exit(1)

    return match.group(1)


def bump_version(current_version: str, bump_type: str) -> str:
    """Bump version number based on type (major, minor, patch)."""
    parts = [int(x) for x in current_version.split(".")]

    if len(parts) != 3:
        print(f"❌ Invalid version format: {current_version}")
        sys.exit(1)

    major, minor, patch = parts

    if bump_type == "major":
        major += 1
        minor = 0
        patch = 0
    elif bump_type == "minor":
        minor += 1
        patch = 0
    elif bump_type == "patch":
        patch += 1
    else:
        print(f"❌ Invalid bump type: {bump_type}")
        sys.exit(1)

    return f"{major}.{minor}.{patch}"


def update_version_in_file(new_version: str) -> None:
    """Update version in pyproject.toml."""
    pyproject_path = Path("pyproject.toml")
    content = pyproject_path.read_text()

    updated_content = re.sub(
        r'version\s*=\s*"[^"]+"', f'version = "{new_version}"', content
    )

    pyproject_path.write_text(updated_content)
    print(f"✅ Updated version in pyproject.toml to {new_version}")


def check_git_status() -> None:
    """Check if git working directory is clean."""
    result = run_command("git status --porcelain", check=False)

    if result.stdout.strip():
        print("⚠️  Warning: Git working directory is not clean!")
        print("Uncommitted changes:")
        print(result.stdout)

        response = input("Continue anyway? (y/N): ")
        if response.lower() != "y":
            print("❌ Deployment cancelled.")
            sys.exit(1)


def run_tests() -> None:
    """Run the test suite."""
    print("🧪 Running tests...")
    run_command("python -m pytest tests/ -v")


def clean_build_artifacts() -> None:
    """Clean previous build artifacts."""
    print("🧹 Cleaning build artifacts...")

    for path in ["build", "dist", "*.egg-info"]:
        if os.name == "nt":  # Windows
            run_command(f"if exist {path} rmdir /s /q {path}", check=False)
        else:  # Unix-like
            run_command(f"rm -rf {path}", check=False)


def build_package() -> None:
    """Build the package."""
    print("📦 Building package...")
    run_command("python -m build")


def upload_to_pypi(test: bool = False) -> None:
    """Upload package to PyPI or TestPyPI."""
    repository = "testpypi" if test else "pypi"
    repository_name = "TestPyPI" if test else "PyPI"

    print(f"🚀 Uploading to {repository_name}...")

    cmd = f"python -m twine upload --repository {repository} dist/*"
    run_command(cmd)


def create_git_tag(version: str) -> None:
    """Create and push git tag."""
    print(f"🏷️  Creating git tag v{version}...")
    run_command("git add pyproject.toml")
    run_command(f'git commit -m "Bump version to {version}"')
    run_command(f"git tag v{version}")

    response = input("Push tag to remote? (Y/n): ")
    if response.lower() != "n":
        run_command("git push")
        run_command("git push --tags")


def main():
    parser = argparse.ArgumentParser(description="Deploy stash-connection-lib package")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--version", help="Explicit version number (e.g., 0.1.1)")
    group.add_argument(
        "--bump", choices=["major", "minor", "patch"], help="Auto-bump version"
    )

    parser.add_argument(
        "--test", action="store_true", help="Deploy to TestPyPI instead of PyPI"
    )
    parser.add_argument("--skip-tests", action="store_true", help="Skip running tests")
    parser.add_argument(
        "--skip-git-check", action="store_true", help="Skip git status check"
    )
    parser.add_argument("--no-tag", action="store_true", help="Don't create git tag")

    args = parser.parse_args()

    # Determine version
    current_version = get_current_version()
    print(f"📋 Current version: {current_version}")

    if args.version:
        new_version = args.version
    else:
        new_version = bump_version(current_version, args.bump)

    print(f"🎯 Target version: {new_version}")

    # Pre-flight checks
    if not args.skip_git_check:
        check_git_status()

    # Update version
    if new_version != current_version:
        update_version_in_file(new_version)

    # Run tests
    if not args.skip_tests:
        run_tests()

    # Build and upload
    clean_build_artifacts()
    build_package()
    upload_to_pypi(test=args.test)

    # Git tagging
    if not args.no_tag and new_version != current_version:
        create_git_tag(new_version)

    repository_name = "TestPyPI" if args.test else "PyPI"
    print(f"🎉 Successfully deployed version {new_version} to {repository_name}!")

    if args.test:
        print(
            f"📋 Test with: pip install -i https://test.pypi.org/simple/ stash-connection-lib=={new_version}"
        )
    else:
        print(f"📋 Install with: pip install stash-connection-lib=={new_version}")


if __name__ == "__main__":
    main()
