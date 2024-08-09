import os
import subprocess

def run_script_on_files(directory, extension, script_to_run):
    # Get a list of all files with the given extension in the specified directory
    files = [f for f in os.listdir(directory) if f.endswith(extension)]

    for file in files:
        # Create the full path to the file
        file_path = os.path.join(directory, file)

        # Run the script and pass the file path as an argument
        process = subprocess.Popen(['python', script_to_run, file_path])
        process.wait()  # Wait for the process to finish

        print(f"Finished processing {file_path}")

if __name__ == "__main__":
    # Directory where the files are located
    directory = "./"

    # File extension to look for
    extension = ".JPG"  # Change this to the file extension you need

    # Python script to run
    script_to_run = "straightener.py"

    run_script_on_files(directory, extension, script_to_run)

