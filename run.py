#!/usr/bin/env python3
"""
Build and run the File Viewer Blazor WebAssembly application locally.

Usage:
    python run.py          # Build and run in development mode
    python run.py build    # Build only (Release)
    python run.py publish  # Publish for deployment
    python run.py clean    # Clean build artifacts
"""

import os
import sys
import subprocess
import shutil

PROJECT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "FileViewer")
PROJECT_FILE = os.path.join(PROJECT_DIR, "FileViewer.csproj")


def run_command(cmd, cwd=None):
    """Run a command and stream output."""
    print(f"\n> {' '.join(cmd)}\n")
    result = subprocess.run(cmd, cwd=cwd or PROJECT_DIR)
    if result.returncode != 0:
        print(f"\nCommand failed with exit code {result.returncode}")
        sys.exit(result.returncode)
    return result


def build():
    """Build the project in Release mode."""
    print("Building File Viewer (Release)...")
    run_command(["dotnet", "build", "-c", "Release"])


def run_dev():
    """Build and run in development mode with hot reload."""
    print("Starting File Viewer in development mode...")
    print("Press Ctrl+C to stop.\n")
    try:
        run_command(["dotnet", "watch", "run"])
    except KeyboardInterrupt:
        print("\nStopped.")


def publish():
    """Publish for deployment."""
    output_dir = os.path.join(os.path.dirname(PROJECT_DIR), "release")
    print(f"Publishing to {output_dir}...")
    run_command([
        "dotnet", "publish", PROJECT_FILE,
        "-c", "Release",
        "-o", output_dir
    ], cwd=os.path.dirname(PROJECT_DIR))
    wwwroot = os.path.join(output_dir, "wwwroot")
    print(f"\nPublished! Static files are in: {wwwroot}")
    print("You can serve these with any static file server.")


def clean():
    """Clean build artifacts."""
    print("Cleaning build artifacts...")
    for d in ["bin", "obj"]:
        path = os.path.join(PROJECT_DIR, d)
        if os.path.exists(path):
            shutil.rmtree(path)
            print(f"  Removed {path}")
    release_dir = os.path.join(os.path.dirname(PROJECT_DIR), "release")
    if os.path.exists(release_dir):
        shutil.rmtree(release_dir)
        print(f"  Removed {release_dir}")
    print("Clean complete.")


def main():
    if len(sys.argv) < 2:
        run_dev()
    else:
        command = sys.argv[1].lower()
        if command == "build":
            build()
        elif command == "publish":
            publish()
        elif command == "clean":
            clean()
        elif command == "run":
            run_dev()
        else:
            print(f"Unknown command: {command}")
            print("Usage: python run.py [build|publish|clean|run]")
            sys.exit(1)


if __name__ == "__main__":
    main()
