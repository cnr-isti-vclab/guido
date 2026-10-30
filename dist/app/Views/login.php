<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Guido login</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body>
    <main class="container py-5" style="max-width: 32rem">
        <h1 class="mb-4">Sign in</h1>
        <?php if ($error): ?>
            <div class="alert alert-danger" role="alert"><?= esc($error) ?></div>
        <?php endif ?>
        <form method="post" action="/login">
            <?= csrf_field() ?>
            <input type="hidden" name="redirect" value="<?= esc($redirect ?? '', 'attr') ?>">
            <div class="mb-3">
                <label for="username" class="form-label">Username</label>
                <input id="username" name="username" class="form-control" autocomplete="username" required>
            </div>
            <div class="mb-3">
                <label for="password" class="form-label">Password</label>
                <input id="password" name="password" type="password" class="form-control" autocomplete="current-password" required>
            </div>
            <button type="submit" class="btn btn-primary">Sign in</button>
        </form>
    </main>
</body>
</html>
