<?php defined('BASEPATH') OR exit('No direct script access allowed');
/* passwordless login: ;e
The link you get with the upload is also set a cookie (the first time, for a while?)
You cannot modify the email on the object.
Link for view should be different? (Share view but not manage?)
Ask link for new cookie (and go to profile)
users.token to store the token, if present AND logged!
*/


class User  extends MY_Controller {

	//this send an email with the token to an email.

	function __construct() { 
		parent::__construct();
		$this->load->library('auth');
	}

	function isValidEmail($email) {
		$re = '/([\w\-\.]+)@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.)|(([\w-]+\.)+))([a-zA-Z]{2,4}|[0-9]{1,3})(\]?)/m';
		preg_match_all($re, $email, $matches, PREG_SET_ORDER, 0);
		if(count($matches) > 0) return $matches[0][0] === $email;
		return false;
	}
	public function passwordless() {
		$email = $this->input->post('email');
		if(!$this->isValidEmail($email))
			$this->error("Invalid email");

		if($email == 'erennacak@gmail.com')
			$this->error("Opted out of passwordless");

		if(!$email)
			redirect('/', 'location');

		$user = $this->auth->createPasswordless($email);

		$user->{'url'} = 'https://'.$_SERVER['HTTP_HOST'].'/login?state=passwordless&code='.$user->validate; 

		$body = $this->load->view('passwordless_email.php', (array)$user, TRUE);

		$this->load->library('email');
		$config = array(
			'protocol'  => 'smtp',
			'smtp_host' => 'smtp-out.isti.cnr.it',
			'smtp_port' =>  587,
			'smtp_user' => 'ponchio',
			'smtp_pass' => 'maldipancismo',
			'smtp_crypto' => 'tls',
			'mailtype'  => 'html',
			'charset'   => 'utf-8'
		);
		$this->email->initialize($config);

		$this->email->from('ponchio@isti.cnr.it', 'Visual Media Service');
		$this->email->to($email);

		$this->email->subject('Visual Media Service login link');
		$this->email->message($body);


		if(!$this->email->send(FALSE)) {
			$this->data['msg'] = '<p>Mail could not be sent because of a technical problem, <br/>'.
				'you can try again or write to <a href="mailto:ponchio@isti.cnr.it">ponchio@isti.cnr.it.it</a></p>';
		} else {
			$this->data['msg'] = "<p>A mail has been sent to your address: $email.<br/>".
				'Check your email and follow the link.</p>';
		}
		//this should be sent to the modal interface, for the moment is a page.
		$this->render('passwordless');
	}

	public function login() {
		$redirect = 'login';
		if(substr($_SERVER['REQUEST_URI'], 0, 6 ) === '/home?') {
			$_GET['state'] = 'd4science';
			$redirect = 'home';
		}

		if(!isset($_GET['code']) || !isset($_GET['state'])) {
			redirect('/ooops', 'location');
		}

		$token = $_GET['code'];
		$state = $_GET['state'];

		switch($_GET['state']) {

		case 'google':
			$user = $this->auth->authenticateGoogle($token);
			break;
		case 'orcid':
			$user = $this->auth->authenticateOrcid($token);
			break;
		case 'passwordless':
			$user = $this->auth->authenticatePasswordless($token);

			break;
		case 'd4science':
		default:
			$user = $this->authenticateD4Science($token, $redirect);
			break;
		}

		if(!$user) {
			$this->data['msg'] = '<p>This is not a valid login link. Ask for a new login link.</p>';
			$this->render('passwordless');
			return;
		}

		//relog anyway even if already logged.
		$this->session->set_userdata('token', $user->token); 

		if(substr($_SERVER['REQUEST_URI'], 0, 7 ) === '/login?')
			redirect('/profile', 'location');
		else
			redirect('', 'refresh');
	}

	public function logout(){
		//delete login status & user info from session
		$this->session->unset_userdata('loggedIn');
		$this->session->unset_userdata('user');
		$this->session->sess_destroy();
		
		redirect('', 'refresh');
	}




	public function listFiles() {
		$path = $_POST['path'];
		if(!$this->session->userdata('loggedIn')) return;
		$user = $this->session->userdata('user');
		$url = 'https://workspace-repository.d4science.org/home-library-webapp/rest/List?absPath=/Home/'.$user['username'].$path;
		$res = $this->getRequest($url, array('gcube-token: '.$user['access_token']));
		echo($res);
	}
	

	function getRequest($url, $headers = NULL) {
		$ch    = curl_init();
		curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
		curl_setopt($ch, CURLOPT_HEADER, false);
		if($headers)
			curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

		curl_setopt($ch, CURLOPT_URL, $url);
		$response = curl_exec($ch);
		curl_close($ch);
		return $response;
	}

	function postRequest($url, $params, $headers = NULL) {
		$query = http_build_query($params);
		$ch    = curl_init();
		curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
		curl_setopt($ch, CURLOPT_HEADER, false);
		if($headers)
			curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

		curl_setopt($ch, CURLOPT_URL, $url);
		curl_setopt($ch, CURLOPT_POST, true);
		curl_setopt($ch, CURLOPT_POSTFIELDS, $query);
		$response = curl_exec($ch);
		curl_close($ch);
		return $response;
	}

	function postJSON($url, $json, $headers = NULL) {
		$ch    = curl_init();
		curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
		curl_setopt($ch, CURLOPT_HEADER, false);
		if($headers)
			curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

		curl_setopt($ch, CURLOPT_URL, $url);
		curl_setopt($ch, CURLOPT_POST, true);
		curl_setopt($ch, CURLOPT_POSTFIELDS, $json);
		$response = curl_exec($ch);
		curl_close($ch);
		return $response;
	}


	public function writeMessage() {
		/*

//		echo("$username is $fullname");
		echo("<br/>");
		echo("Token: ". $access->access_token);
		echo("<br/>");
		$json = $this->postJSON($people_url."2/messages/write-message?gcube-token=".$access->access_token,
		'{ "body": "test message body", "subject": "test mail subject 2", "recipients": [ { "id": "'.$result->username.'" } ] }',
			array('Content-Type: application/json', 'gcube-token: '.$access->access_token));
		echo($json);
		echo("<br/>");


*/
	}



/* old stuff 
	public function checkUser($data = array()) {
		$user = array();
		foreach(array('username', 'name', 'email', 'oauth_provider', 'access_token', 'refresh_token') as $i)
			$user[$i] = $data[$i];
		$q = "SELECT * FROM users WHERE username = ?";

		$query = $this->db->query($q, $data['username']);

		$check = $query->num_rows();
		
		if($check > 0) {

			$result = $query->first_row();
			$user['institution'] = $result->institution;
			$user['id'] = $result->id;

			$this->db->where('id', $result->id);
			$this->db->update('users', array("access_token"=>$user["access_token"]));

		} else {

			$data['created']= date("Y-m-d H:i:s");
			$insert = $this->db->insert('users', $data);
			$user['id'] = $this->db->insert_id();

			$q = 'update media set userid = ? where email = ?';
			$this->db->query($q, array($user['id'], $data['email']));
		}


		return $user;
	} */
}
?>
