
<?php

// Define the file path where data will be saved
$filePath = '/home/ganovell/Documents/devel/guido/dist/datasets/lucca/lucca/dataset.json';


// Check if POST data exists
$postData = file_get_contents('php://input');

if (empty($postData)) {
    http_response_code(400); // Bad Request
    exit('{"error": "No data received"}');
}


// Get the current date and time formatted as a string
$currentDateTime = date('Y-m-d_H-i-s'); // Example format: 2024-05-09_15-30-45

// Extract the filename without extension and extension separately
$dirname = pathinfo($filePath, PATHINFO_DIRNAME);
$filenameWithoutExtension = pathinfo($filePath, PATHINFO_FILENAME); // 'A'
$fileExtension = pathinfo($filePath, PATHINFO_EXTENSION); // 'json'

// Construct the new filename with current date and time
$newFilename =$dirname.'/'.$filenameWithoutExtension . '_' . $currentDateTime . '.' . $fileExtension;

error_log($newFilename	);

rename($filePath,$newFilename);



// Decode JSON data
$jsonData = json_decode($postData, true);
if ($jsonData === null) {
    http_response_code(400); // Bad Request
    exit('{"error": "Invalid JSON data"}');
}


// Encode JSON data to pretty-printed format
$encodedData = json_encode($jsonData, JSON_PRETTY_PRINT);

// Save JSON data to file
if (file_put_contents($filePath, $encodedData) === false) {
    http_response_code(500); // Internal Server Error
    exit('{"error": "Failed to save data"}');
}
chmod($filePath,0666);
error_log("ANDATA");

// Respond with success message
//http_response_code(200); // OK

$data = ['done'=> true];
$str = json_encode($data,true);
echo($str);

?>
