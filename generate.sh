for i in /home/ganovell/Documents/devel/guido/dist/miracoli/panos/piazza/R0010368.JPG; do
rm -rf ${i%.JPG};
python3 generate.py $i --nona=nona --output ${i%.JPG} ;
echo ${i%.JPG};
done;
