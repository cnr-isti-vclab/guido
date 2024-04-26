for i in /home/ponchio/guido/dist/miracoli/panos/sansisto/*.JPG; do
#rm -rf ${i%.JPG};
python3 generate.py $i --nona=nona --output ${i%.JPG} ;
done;
