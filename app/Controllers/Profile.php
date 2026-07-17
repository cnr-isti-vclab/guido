<?php defined('BASEPATH') OR exit('No direct script access allowed');
/* passwordless login: ;e
The link you get with the upload is also set a cookie (the first time, for a while?)
You cannot modify the email on the object.
Link for view should be different? (Share view but not manage?)
Ask link for new cookie (and go to profile)
users.token to store the token, if present AND logged!
*/


class Profile  extends MY_Controller {

	public function index($target = null) {
		$user = $this->user();
		if(!$user) //not logged in
			redirect('/', 'location');

		if($target && $this->isAdmin())
			$target = $this->db->query('SELECT * from users where id = ?;', $target)->row();
		else
			$target = $user;

		if(!$target)
			redirect('/', 'location');

		$this->data['target'] = $target;
		$this->data['objects'] = $this->media->userMediaById($target->id);
		//TODO create usercollection function?
		$this->data['collections'] = $this->db->query('SELECT * from collections where userid = ?', $target->id)->result(); 

		$this->load->model('media');
		$this->load->model('collection');
		$this->render('profile');
	}

	public function testUsername($username) {
		if(!$this->isLogged())
			return;
		$this->output->set_content_type('application/json');
		echo '{ "exists": '. ($this->usernameExists($username)?'true':'false').' }';
	}

	public function usernameExists($username) {
		$id = $this->user()->id;
		$test = $this->db->query("SELECT id FROM users WHERE id != ? AND username = ?", array($id, $username))->row();
		return $test != NULL;
	}

	function isValidEmail($email) {
		$re = '/([\w\-\.]+)@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.)|(([\w-]+\.)+))([a-zA-Z]{2,4}|[0-9]{1,3})(\]?)/m';
		preg_match_all($re, $email, $matches, PREG_SET_ORDER, 0);
		if(count($matches) > 0) return $matches[0][0] === $email;
		return false;
	}

	public function updateProfile() {
		if(!$this->isLogged()) {
			$this->error("</p>It looks like you are not logged in. Maybe the session expired or the cookies were deleted.</p>".
				"<p>Please login and try again...</p>");
		}
		$user = $this->user();
		//cannot change email!

		$data = array(
			'name'=>$_POST['name'],
			'institution'=>$_POST['institution'], 
			'sendemail'=>isset($_POST['sendemail'])?1:0,
			'username'=>$_POST['username']);

		if(!$user->email) {//allow to change email only if empty email: logged in through d4science, for example.
			$email = $_POST['email'];
			if(!$this->isValidEmail($email)) {
				echo json_encode(['error' => 'Invalid email']);
				return;
			}
			$data['email'] = $_POST['email'];
		}
		$this->db->where('id', $user->id);
		$this->db->update('users', $data);
		echo json_encode($user); //"{}";
	}
}

