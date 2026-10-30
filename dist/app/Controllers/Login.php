<?php

namespace App\Controllers;

class Login extends BaseController
{
    public function index()
    {
        return view('login', [
            'redirect' => $this->validRedirect($this->request->getGet('redirect')),
            'error' => session()->getFlashdata('auth_error'),
        ]);
    }

    public function authenticate()
    {
        $redirect = $this->validRedirect($this->request->getPost('redirect'));
        $username = strtolower(trim((string) $this->request->getPost('username')));
        $password = (string) $this->request->getPost('password');
        $user = db_connect()->table('guido_users')
            ->where('username', $username)
            ->get()
            ->getRowArray();

        if (! $user || strlen($password) > 1024 || ! password_verify($password, $user['password_hash'])) {
            session()->setFlashdata('auth_error', 'Invalid username or password.');
            return redirect()->to('/login' . ($redirect ? '?redirect=' . rawurlencode($redirect) : ''));
        }

        $roles = json_decode($user['roles'], true);
        if (! is_array($roles)) {
            throw new \RuntimeException('The account has invalid role data.');
        }

        $requiredRole = $this->roleFromRedirect($redirect);
        if ($requiredRole && ! in_array($requiredRole, $roles, true)) {
            session()->setFlashdata('auth_error', 'This account is not authorized for that mode.');
            return redirect()->to('/login' . ($redirect ? '?redirect=' . rawurlencode($redirect) : ''));
        }

        session()->regenerate(true);
        session()->set([
            'guido_user_id' => (int) $user['id'],
            'guido_username' => $user['username'],
            'guido_roles' => $roles,
        ]);

        return redirect()->to($redirect ?: '/');
    }

    public function logout()
    {
        session()->remove(['guido_user_id', 'guido_username', 'guido_roles']);
        session()->regenerate(true);

        return redirect()->to('/');
    }

    private function validRedirect(?string $redirect): ?string
    {
        if ($redirect === null || ! preg_match('#\A/tours/[a-zA-Z0-9_-]+(?:\?role=(?:guide|editor))?\z#', $redirect)) {
            return null;
        }

        return $redirect;
    }

    private function roleFromRedirect(?string $redirect): ?string
    {
        if (! $redirect || strpos($redirect, '?role=') === false) {
            return null;
        }

        return substr($redirect, strpos($redirect, '=') + 1);
    }
}
