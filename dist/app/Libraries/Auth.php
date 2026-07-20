<?php

class Auth {

	var $db;

function __construct() { 
	$this->db = &get_instance()->db;
	$this->session = &get_instance()->session;
}

public function hash($salt) {
	date_default_timezone_set('UTC');
	$now = date('Y-m-d H:i:s');
	return md5($now.$salt);
}

public function addUser($user, $identity) {
	date_default_timezone_set('UTC');
	$user['created'] =  date('Y-m-d H:i:s');
	$user['validate'] = $this->hash("validate");
	$this->db->insert('users', $user);
	$userid = $this->db->insert_id();

	$identity['userid'] = $userid;
	$identity['token'] = $this->hash("token");
	$this->db->insert('identities', $identity);
}

public function addIdentity($identity) {
	$identity['token'] = $this->hash($identity['userid']."token");
	$this->db->insert('identities', $identity);
}

/* PASSWORDLESS */

public function createPasswordless($email) {

	$user = $this->db->query("SELECT u.*, i.userid from users u LEFT JOIN identities i on i.userid = u.id and provider='passwordless' WHERE email = ?", $email)->row();
	date_default_timezone_set('UTC');

	if(!$user)
		$this->adduser(array('email'=>$email), array('provider'=>'passwordless', 'uid'=>$this->hash($user->id)));

	//userid is used only to test if at least a passwordless identity is associated with the user
	if(!$user->userid)
		$this->addidentity(array('userid'=>$user->id, 'provider'=>'passwordless', 'uid'=>$this->hash($user->id)));


	$user = $this->db->query("SELECT * from users u JOIN identities i on i.userid = u.id WHERE provider='passwordless' AND email = ?", $email)->row();

	$user->{'validate'} = $this->hash("validate1");
	$this->db->query("UPDATE users SET validate = ? WHERE id = ?", array($user->validate, $user->id));

	return $user;
}

public function authenticatePasswordless($token) {
	return $this->db->query("SELECT * from users u JOIN identities i on i.userid = u.id WHERE provider='passwordless' AND validate = ?", $token)->row();
}

/* GOOGLE */

public function initGoogle() {
	$client_id = '257893829634-3l1e27frsg2vp8d014sumd93bgtrtg7g.apps.googleusercontent.com';
	$client_secret = 'UGWx0XQMT-OPXaSAFftj-oyO';
#		$redirect_uri = 'https://ariadne.isti.cnr.it/login'; //http://visual.ariadne-infrastructure.eu/login

	$host = $_SERVER['HTTP_HOST'];
	if($host == '146.48.85.249')
		$host = 'visual.ariadne-infrastructure.eu';

	$redirect_uri = "https://$host/login"; 
	$application_name = 'Ariadne';
	$api_key  = '';
	$scopes  = array('https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile');

	require APPPATH .'third_party/Google/vendor/autoload.php';

	$client = new Google_Client();
	$client->setApplicationName($application_name);
	$client->setClientId($client_id);
	$client->setClientSecret($client_secret);
	$client->setRedirectUri($redirect_uri);
	$client->setDeveloperKey($api_key);
	$client->setScopes($scopes);

//		use this for refresh token
	$client->setAccessType('offline');
	$client->setApprovalPrompt('force'); 
//		$client->setAccessType('online');
//		$client->setApprovalPrompt('auto');

	$client->setState('google');
	return $client;
}



public function authenticateGoogle($code) {
	$client = $this->initGoogle();
	$oauth2 = new Google_Service_Oauth2($client);

	//authenticate user
	$response = $client->authenticate($code);
	if(isset($response['error']))
		show_error($response['error'].': '.$response['error_description'], 403);

	//get user info from google
	$info = $oauth2->userinfo->get();
	$access = $client->getAccessToken();
		
	$email = $info['email'];
	$name  = $info['given_name'].' '.$info['family_name'];

	$identity = 	array('access_token'=>$access['access_token'], 'refresh_token'=> $access['refresh_token'], 'uid'=>$info['id']);

	//check wether this identity exists.
	$user = $this->db->query("SELECT * FROM users u LEFT JOIN identities i on i.userid = u.id AND i.provider='google' WHERE email = ?", $email)->row();

	if(!$user) {                       //create user and identity
		$identity['provider'] = 'google';
		$this->addUser(array('email'=>$email, 'name'=>$name), $identity);

	} else if(!$user->provider) {      //create identity
		$identity['userid'] = $user->id;
		$identity['provider'] = 'google';
		$this->db->insert('identities', $identity);

	} else {                           //update identity
		$this->db->where('provider', 'google');
		$this->db->where('userid', $user->id);
		$this->db->update('identities', $identity);
	}


	return $this->db->query("SELECT * from users u JOIN identities i on i.userid = u.id WHERE provider='google' AND email = ?", $email)->row();
}
	

	//the token is passed when the user is already logged in the d4science.

	//this is used for login
public function authenticateD4Science($code, $redirect) {
	$client_id = 'a4dcada3-5b17-4b85-8fa4-6281f12507c4';
	$client_secret = 'f9f058f3-f44d-4ca8-a4c5-c589ee80588c-843339462';
	$auth_url = 'https://socialnetworking1.d4science.org/gcube-oauth/v2/access-token';
	$people_url ='https://socialnetworking1.d4science.org/social-networking-library-ws/rest/';

	$headers = array(
		'Content-Type: application/x-www-form-urlencoded',
		'gcube-token: '.$client_secret);


	if($redirect == 'login') {
		$params = array(
			'url'=>$auth_url,
			'grant_type'=>'authorization_code',
			'code'=>$code,
			'redirect_uri' => 'https://'.$_SERVER['HTTP_HOST'].'/login',
			'client_id'=> $client_id,
			'client_secret'=>$client_secret);
	
		$res = $this->postRequest($auth_url, $params, $headers);
		$access = json_decode($res);

		if(!$access || !isset($access->access_token)) {
			show_error($access->error.': '.$access->error_description, 403);
		}
		$token = $access->access_token;

	} else {
		$token = $code;
	}

	$json = file_get_contents($people_url."2/people/profile?gcube-token=".$token);
	$obj = json_decode($json);

	$success = $obj->success; //true
	$message = $obj->message; //in case of error
	$result = $obj->result;

	//preparing data for database insertion
	$d4user = array(
		'oauth_provider' => 'd4science',
		'oauth_uid'      => '',
		'name'           => $result->fullname,
		'username'       => $result->username,
		'email'          => '',
		'picture_url'    => $result->avatar,
		'access_token'   => $token,
		'refresh_token'  => ''
	);
		

	$identity = array('access_token'=>$token, 'refresh_token'=> '', 'uid'=>$result->username);

	//check wether this identity exists.
	$user = $this->db->query("SELECT * FROM users u LEFT JOIN identities i on i.userid = u.id AND i.provider='d4science' WHERE uid = ?", $result->username)->row();

	if(!$user) {                       //create user and identity
		$identity['provider'] = 'd4science';
		$this->addUser(array('name'=>$result->fullname, 'username'=>$result->username), $identity);
	} else {                           //update identity
		$this->db->where('provider', 'd4science');
		$this->db->where('userid', $user->id);
		$this->db->update('identities', $identity);
	}


	$user = $this->db->query("SELECT * FROM users u LEFT JOIN identities i on i.userid = u.id AND i.provider='d4science' WHERE uid = ?", $result->username)->row();

	return $user;
}

public function authenticateOrcid($code) {

		$headers = array('Accept: application/json', 'Content-Type: application/x-www-form-urlencoded');
		$params = array(
				'url'           =>'https://orcid.org/oauth/token',
				'grant_type'    =>'authorization_code',
				'code'          =>$code,
				'redirect_uri'  => 'https://'.$_SERVER['HTTP_HOST'].'/login',
				'client_id'     => 'APP-INSSY2VKBR9EV73P',
				'client_secret' =>'f38ad7dc-0bd3-44ac-acef-44963f2c62ec');
	
		$res = $this->postRequest('https://orcid.org/oauth/token', $params, $headers);
		$info = json_decode($res);
		if(isset($info->error)) {
			echo($info->error. ' ' .$info->error_description);
			exit(0);
		}

		$name = $info->name;
		$uid  = $info->orcid;

		$identity = 	array(
			'access_token'  => $info->access_token, 
			'refresh_token' => $info->refresh_token, 
			'uid'           => $uid);

		//check wether this identity exists.
		$user = $this->db->query("SELECT * FROM users u LEFT JOIN identities i on i.userid = u.id AND i.provider='orcid' WHERE uid = ?", $uid)->row();

		if(!$user) {                       //create user and identity
			$identity['provider'] = 'orcid';
			$this->addUser(array('name'=>$name, 'username'=>$uid), $identity);
		} else {                           //update identity
			$this->db->where('provider', 'orcid');
			$this->db->where('userid', $user->id);
			$this->db->update('identities', $identity);
		}


		$user = $this->db->query("SELECT * FROM users u LEFT JOIN identities i on i.userid = u.id AND i.provider='orcid' WHERE uid = ?", $uid)->row();

		return $user;
	}


}

?>
