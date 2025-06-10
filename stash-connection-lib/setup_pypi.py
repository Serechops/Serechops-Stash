#!/usr/bin/env python3
"""
First-time setup script for PyPI deployment.
Run this once to install required tools and configure PyPI credentials.
"""

import os
import subprocess
import sys
from pathlib import Path


def run_command(cmd: str) -> None:
    """Run a shell command."""
    print(f"🔧 Running: {cmd}")
    result = subprocess.run(cmd, shell=True)
    if result.returncode != 0:
        print(f"❌ Command failed: {cmd}")
        sys.exit(1)


def install_dependencies() -> None:
    """Install required packages for deployment."""
    print("📦 Installing deployment dependencies...")

    packages = [
        "build",  # For building packages
        "twine",  # For uploading to PyPI
        "setuptools",  # Build system
        "wheel",  # Wheel format support
    ]

    for package in packages:
        run_command(f"pip install --upgrade {package}")


def configure_pypi_credentials() -> None:
    """Help user configure PyPI credentials."""
    print("\n🔑 PyPI Credentials Setup")
    print("=" * 50)

    pypirc_path = Path.home() / ".pypirc"

    if pypirc_path.exists():
        print("✅ .pypirc already exists")
        with open(pypirc_path) as f:
            content = f.read()

        if "[testpypi]" in content and "[pypi]" in content:
            print("✅ Both PyPI and TestPyPI configurations found")
            return

    print("⚠️  PyPI credentials not configured!")
    print("\nYou have two options:")
    print("1. Use API tokens (recommended)")
    print("2. Use username/password")

    choice = input("\nUse API tokens? (Y/n): ")

    if choice.lower() != "n":
        setup_api_tokens()
    else:
        setup_username_password()


def setup_api_tokens() -> None:
    """Setup API token authentication."""
    print("\n📋 API Token Setup Instructions:")
    print("1. Go to https://pypi.org/manage/account/token/")
    print("2. Create a new API token with 'Entire account' scope")
    print("3. Copy the token (starts with 'pypi-')")
    print("4. Go to https://test.pypi.org/manage/account/token/")
    print("5. Create a test token there too")

    pypi_token = input("\nEnter your PyPI API token: ").strip()
    test_pypi_token = input("Enter your TestPyPI API token: ").strip()

    if not pypi_token.startswith("pypi-") or not test_pypi_token.startswith("pypi-"):
        print("❌ Invalid token format! Tokens should start with 'pypi-'")
        return

    pypirc_content = f"""[distutils]
index-servers =
    pypi
    testpypi

[pypi]
username = __token__
password = {pypi_token}

[testpypi]
repository = https://test.pypi.org/legacy/
username = __token__
password = {test_pypi_token}
"""

    pypirc_path = Path.home() / ".pypirc"
    pypirc_path.write_text(pypirc_content)

    # Set appropriate permissions (Unix-like systems)
    if os.name != "nt":
        os.chmod(pypirc_path, 0o600)

    print("✅ API tokens configured successfully!")


def setup_username_password() -> None:
    """Setup username/password authentication."""
    print("\n📋 Username/Password Setup:")

    pypi_username = input("PyPI username: ").strip()
    pypi_password = input("PyPI password: ").strip()
    test_username = input("TestPyPI username: ").strip()
    test_password = input("TestPyPI password: ").strip()

    pypirc_content = f"""[distutils]
index-servers =
    pypi
    testpypi

[pypi]
username = {pypi_username}
password = {pypi_password}

[testpypi]
repository = https://test.pypi.org/legacy/
username = {test_username}
password = {test_password}
"""

    pypirc_path = Path.home() / ".pypirc"
    pypirc_path.write_text(pypirc_content)

    # Set appropriate permissions (Unix-like systems)
    if os.name != "nt":
        os.chmod(pypirc_path, 0o600)

    print("✅ Credentials configured successfully!")


def verify_setup() -> None:
    """Verify the setup is working."""
    print("\n🧪 Verifying setup...")

    # Check if packages are installed
    packages = ["build", "twine"]
    for package in packages:
        result = subprocess.run(
            [sys.executable, "-c", f"import {package}"], capture_output=True
        )
        if result.returncode == 0:
            print(f"✅ {package} is installed")
        else:
            print(f"❌ {package} is not installed")
            return False

    # Check credentials
    pypirc_path = Path.home() / ".pypirc"
    if pypirc_path.exists():
        print("✅ .pypirc file exists")
    else:
        print("❌ .pypirc file not found")
        return False

    print("✅ Setup verification complete!")
    return True


def main():
    print("🚀 PyPI Deployment Setup")
    print("=" * 30)

    print("\nThis script will:")
    print("• Install required packages (build, twine)")
    print("• Help configure PyPI credentials")
    print("• Verify the setup")

    proceed = input("\nProceed? (Y/n): ")
    if proceed.lower() == "n":
        print("Setup cancelled.")
        return

    install_dependencies()
    configure_pypi_credentials()

    if verify_setup():
        print("\n🎉 Setup complete! You can now use deploy.py to publish packages.")
        print("\nNext steps:")
        print("1. Test deployment: python deploy.py --version 0.1.1 --test")
        print("2. Real deployment: python deploy.py --version 0.1.1")
    else:
        print("\n❌ Setup incomplete. Please check the errors above.")


if __name__ == "__main__":
    main()
