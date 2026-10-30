<?php

namespace App\Commands;

use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;

class GuidoCreateUser extends BaseCommand
{
    protected $group = 'Guido';
    protected $name = 'guido:user:create';
    protected $description = 'Create or update a Guido guide/editor account.';
    protected $usage = 'guido:user:create';

    public function run(array $params)
    {
        $username = strtolower(trim(CLI::prompt('Username')));
        if (! preg_match('/\A[a-z0-9_.-]{3,64}\z/', $username)) {
            CLI::error('Username must be 3-64 characters and contain only letters, numbers, dots, underscores, or hyphens.');
            return EXIT_ERROR;
        }

        $password = $this->promptPassword();
        if (strlen($password) < 12 || strlen($password) > 1024) {
            CLI::error('Password must be between 12 and 1024 characters.');
            return EXIT_ERROR;
        }
        if (! hash_equals($password, $this->promptPassword())) {
            CLI::error('Passwords do not match.');
            return EXIT_ERROR;
        }

        $roles = array_unique(array_map('trim', explode(',', strtolower(CLI::prompt('Roles (guide, editor, or guide,editor)')))));
        if (! $roles || array_diff($roles, ['guide', 'editor'])) {
            CLI::error('Roles must be guide, editor, or both.');
            return EXIT_ERROR;
        }

        $db = db_connect();
        $table = $db->table('guido_users');
        $existing = $table->where('username', $username)->get()->getRowArray();
        $account = [
            'username' => $username,
            'password_hash' => password_hash($password, PASSWORD_DEFAULT),
            'roles' => json_encode(array_values($roles), JSON_THROW_ON_ERROR),
        ];

        if ($existing) {
            $table->where('id', $existing['id'])->update($account);
            CLI::write('Account updated.', 'green');
        } else {
            $table->insert($account);
            CLI::write('Account created.', 'green');
        }

        return EXIT_SUCCESS;
    }

    private function promptPassword(): string
    {
        if (PHP_OS_FAMILY === 'Windows') {
            $command = 'powershell -NoProfile -Command "$secure = Read-Host -Prompt Password -AsSecureString; '
                . '$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure); '
                . 'try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) } '
                . 'finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }"';
            exec($command, $output, $status);
            if ($status !== 0 || ! isset($output[0])) {
                throw new \RuntimeException('Could not securely read the password from PowerShell.');
            }

            return $output[0];
        }

        $terminalMode = trim((string) shell_exec('stty -g'));
        if ($terminalMode === '') {
            throw new \RuntimeException('Run this command from an interactive terminal to enter the password securely.');
        }

        echo 'Password: ';
        shell_exec('stty -echo');
        try {
            $password = rtrim((string) fgets(STDIN), "\r\n");
        } finally {
            shell_exec('stty ' . escapeshellarg($terminalMode));
            CLI::newLine();
        }

        return $password;
    }
}
