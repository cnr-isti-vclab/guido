# usage: tarificator <relative path> 

#main function

import sys
import os
import time
import tarfile
from glob import glob

import shutil

def cleanup(target_dir):
    # Ensure the directory exists
    if not os.path.exists(target_dir):
        print(f"Directory {target_dir} does not exist.")
        return

    # List all items in the directory
    for item in os.listdir(target_dir):
        item_path = os.path.join(target_dir, item)
        
        # Skip the file we want to keep
        if item == "files.tar" or item == "files.index" or item == ".htaccess":
            continue
            
        # Delete files or folders
        try:
            if os.path.isfile(item_path) or os.path.islink(item_path):
                os.unlink(item_path)  # Removes file or link
            elif os.path.isdir(item_path):
                shutil.rmtree(item_path)  # Removes directory and its contents
            print(f"Deleted: {item}")
        except Exception as e:
            print(f"Failed to delete {item}: {e}")

#check is the folder exists and is relative
def check_folder(folder):
	if not os.path.exists(folder):
		print("Folder does not exist")
		return False
	if os.path.isabs(folder):
		print("Folder is not relative")
		return False
#check if a tar is present
	if os.path.exists(folder + "/files.tar"):
		print("Tar file already exists")
		return False
#count number of files and directories
	tot = len(glob(folder + "/**/*", recursive=True))
	print("Total files and directories: " + str(tot))
	return True

def human(size):
	a = 'B','kB','mB','gB','tB','pB'
	curr = 'B'
	while( size > 1024 ):
		size/=1024
		curr = a[a.index(curr)+1]
	return str(int(size*10)/10)+curr

#tarify the folder
def tarify(folder):
#ensure folder does not ends with a /

	dbtarfile = os.path.join(folder, "files.tar")
	indexfile = os.path.join(folder, "files.index")

	# Create the tar file using Python's native library
	print("Creating the tar file...")
	with tarfile.open(dbtarfile, "w") as tar:
		for root, dirs, files in os.walk(folder):
			for file in files:
				file_path = os.path.join(root, file)
				# Exclude the archive itself if it's already created
				if os.path.abspath(file_path) == os.path.abspath(dbtarfile):
					continue
				# Add file with a clean relative path
				arcname = os.path.relpath(file_path, folder)
				tar.add(file_path, arcname=arcname)

	print(f"Archive created: {dbtarfile}")

	filesize = os.path.getsize(dbtarfile)
	lastpercent = 0
	
	starttime = time.time()

	with tarfile.open(dbtarfile, 'r|') as db:
		if os.path.isfile(indexfile):
			print('file exists. exiting')

		with open(indexfile, 'w') as outfile:
			counter = 0
			print('One dot stands for 1000 indexed files.')
			#tarinfo = db.next()
			for tarinfo in db:
				if tarinfo.name == '.':
					continue
				#tarinfo.name = tarinfo.name[2:]
				currentseek = tarinfo.offset_data
				rec = "%s\t%d\t%d\n" % (tarinfo.name, tarinfo.offset_data, tarinfo.size)
				outfile.write(rec)
				counter += 1
				if counter % 1000 == 0:
					# free ram...
					db.members = []
				if(currentseek/filesize>lastpercent):
					print('')
					percent = int(currentseek/filesize*1000.0)/10
					print(str(percent)+'%')
					lastpercent+=0.01
					print(human(currentseek)+'/'+human(filesize))
					if(percent!=0):
						estimate = ((time.time()-starttime)/percent)*100
						eta = (starttime+estimate)-time.time()
						print('ETA: '+str(int(eta))+'s (estimate '+str(int(estimate))+'s)')

	#write the .htaccess file in the folder
	htaccess = folder + "/.htaccess"


	if "datasets/" in folder:
		extracted = "datasets/" + folder.split("datasets/")[1]

	with open(htaccess, 'w') as ht:
		ht.write("RewriteEngine On\nRewriteCond %{REQUEST_FILENAME} !-f\nRewriteCond %{REQUEST_FILENAME} !-d\nRewriteRule ^(.*)$ /tarindex.php/$1?" + extracted + " [L,QSA]\n")
	
	print('done.')

def main():
	if len(sys.argv) < 2:
		print("Usage: tarificator <relative path>")
		exit(0)
	
	path = sys.argv[1]

	if path[-1] == '/':
		path = path[:-1]
	
	if not check_folder(path):
		exit(0)
	
	#tarify the folder
	tarify(path)

	cleanup(path)

if __name__ == "__main__":
	main()
