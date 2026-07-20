<?php


$mime_types = array(
	'jpg' => array('image/jpeg', 'image/pjpeg'), 
	'dzi' => array('application/xml', 'text/xml'), 
	'xml' => array('application/xml', 'text/xml'), 
	'json' => array('application/json', 'text/plain')
);

#define a php class with string and two integers


if(isset($argv)) {
	$base = $argv[1];
	$file = $argv[2];
} else {
	$file = rawurldecode($_SERVER['PATH_INFO']);
	$base = rawurldecode($_SERVER['QUERY_STRING']);
	$file = substr($file, 1);
}

$ext = pathinfo($file, PATHINFO_EXTENSION);

$index = fopen($base.'/files.index', "r");
if(!$index) {

	http_response_code(404);
	exit(0);
}
while (!feof($index)) {
	$line = fgets($index);
	$row = explode("\t", $line);

	if($row[0] == $file) {
		$filesize = intval($row[2]);
		$data = file_get_contents($base.'/files.tar', false, null, intval($row[1]), $filesize);
		// Check if the extension exists in the array
		if (isset($mime_types[$ext])) {
			// Get the first mime type from the array
			$mime_type = $mime_types[$ext][0]; 
		} else {
			$mime_type = 'application/octet-stream';
		}
		header("Content-Type: $mime_type");
		header("Content-Length: $filesize");
		print($data);
		exit(0);
	}
}

http_response_code(404);
