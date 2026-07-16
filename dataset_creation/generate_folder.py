import os
import subprocess
import argparse
import sys

def batch_process(source_folder, output_base_folder):
    # Path to your existing generate.py script
    generate_script = r'generate.py'

    if not os.path.exists(source_folder):
        print(f"Error: Source folder '{source_folder}' does not exist.")
        return

    # Loop through all files in the source folder
    for filename in os.listdir(source_folder):
        if filename.lower().endswith(('.jpg', '.jpeg', '.png')):
            file_path = os.path.join(source_folder, filename)
            
            # Get filename without extension for the output folder
            name_without_suffix = os.path.splitext(filename)[0]
            output_path = os.path.join(output_base_folder, name_without_suffix)
            
            print(f"--- Processing: {filename} ---")

            # Construct the command
            # Using 'nona' directly as it is in your system PATH
            cmd = [
                sys.executable, generate_script, 
                file_path, 
                '--nona=nona', 
                '--output', output_path
            ]
            
            try:
                subprocess.check_call(cmd)
                print(f"Successfully processed: {filename}")
            except subprocess.CalledProcessError as e:
                print(f"Error processing {filename}: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Batch process panoramas using generate.py")
    parser.add_argument("source", help="Path to the folder containing input images")
    parser.add_argument("output", help="Path to the folder where output tiles will be saved")
    
    args = parser.parse_args()
    
    batch_process(args.source, args.output)