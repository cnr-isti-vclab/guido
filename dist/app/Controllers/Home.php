<?php

namespace App\Controllers;

class Home extends BaseController
{
    public function index() {
        return view('home');
    }
    
    public function tours($dataset) {
        if (! preg_match('/\A[a-zA-Z0-9_-]+\z/', $dataset)) {
            return $this->response->setStatusCode(404);
        }

        $role = $this->request->getGet('role');
        if (in_array($role, ['guide', 'editor'], true)
            && ! in_array($role, $this->currentRoles(), true)) {
            $redirect = '/tours/' . rawurlencode($dataset) . '?role=' . $role;
            return redirect()->to('/login?redirect=' . rawurlencode($redirect));
        }

        $data = [
            'role' => in_array($role, ['guide', 'editor'], true) ? $role : 'tourist',
            'dataset' => '/datasets/' . $dataset . '/dataset.json',
            'saveurl' => '/save/datasets/' . rawurlencode($dataset) . '/dataset.json',
            'host' => config('Guido')->host,
            'authToken' => $role === 'guide' ? $this->createGuideToken() : null,
        ];

        return view('tour', $data);
    }

    public function save($dataset)
    {
        if (! in_array('editor', $this->currentRoles(), true)) {
            return $this->response->setStatusCode(403)->setJSON(['error' => 'Forbidden']);
        }

        if (! preg_match('/\A[a-zA-Z0-9_-]+\z/', $dataset)) {
            return $this->response->setStatusCode(404)->setJSON(['error' => 'Dataset not found']);
        }

        $filename = ROOTPATH . 'public/datasets/' . $dataset . '/dataset.json';
        if (! is_file($filename)) {
            return $this->response->setStatusCode(404)->setJSON(['error' => 'Dataset not found']);
        }

        $contents = $this->request->getBody();
        json_decode($contents);
        if (json_last_error() !== JSON_ERROR_NONE) {
            return $this->response->setStatusCode(400)->setJSON(['error' => 'Invalid JSON']);
        }

        if (file_put_contents($filename, $contents, LOCK_EX) === false) {
            return $this->response->setStatusCode(500)->setJSON(['error' => 'Could not save dataset']);
        }

        return $this->response->setJSON(['done' => true]);
    }

    private function createGuideToken(): string
    {
        $secret = config('Guido')->authSecret;
        if (strlen($secret) < 32) {
            throw new \RuntimeException('GUIDO_AUTH_SECRET must be set to at least 32 characters to enable guide access.');
        }

        $encode = static fn (string $value): string => rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
        $header = $encode(json_encode(['alg' => 'HS256', 'typ' => 'JWT'], JSON_THROW_ON_ERROR));
        $payload = $encode(json_encode([
            'sub' => (string) session()->get('guido_username'),
            'roles' => ['guide'],
            'exp' => time() + 7200,
        ], JSON_THROW_ON_ERROR));
        $signature = $encode(hash_hmac('sha256', $header . '.' . $payload, $secret, true));

        return $header . '.' . $payload . '.' . $signature;
    }

    private function currentRoles(): array
    {
        $userId = session()->get('guido_user_id');
        if (! $userId) {
            return [];
        }

        $user = db_connect()->table('guido_users')
            ->select('roles')
            ->where('id', $userId)
            ->get()
            ->getRowArray();
        if (! $user) {
            session()->remove(['guido_user_id', 'guido_username', 'guido_roles']);
            return [];
        }

        $roles = json_decode($user['roles'], true);
        if (! is_array($roles)) {
            throw new \RuntimeException('The account has invalid role data.');
        }

        session()->set('guido_roles', $roles);
        return $roles;
    }
}
