<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<title>Guido</title>
	<meta name="description" content="Guido">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<!-- <link rel="shortcut icon" type="image/png" href="/favicon.ico"> -->
	<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-EVSTQN3/azprG1Anm3QDgpJLIm9Nao0Yz1ztcQTwFspd3yD65VohhpuuCOmLASjC" crossorigin="anonymous">
	<title>Guido</title>
</head>
<body>
	<div class="container py-3">	
		<header>
			<div class="d-flex flex-column flex-md-row align-items-center pb-3 mb-4 border-bottom">
				<a href="guido/" class="d-flex align-items-center text-dark text-decoration-none">
					<span class="fs-4">Guido</span>
				</a>

				<nav class="d-inline-flex mt-2 mt-md-0 ms-md-auto">
					<a class="me-3 py-1 text-dark text-decoration-none" href="start">Start</a>
					<a class="me-3 py-1 text-dark text-decoration-none" href="docs">Docs</a>
					<a class="me-3 py-1 text-dark text-decoration-none" href="https://github.com/cnr-isti-vclab/guido">Github</a>
					<?php if (session()->has('guido_user_id')): ?>
						<form method="post" action="/logout" class="d-inline">
							<?= csrf_field() ?>
							<button class="btn btn-outline-dark py-1" type="submit">Logout</button>
						</form>
					<?php else: ?>
						<a class="btn btn-outline-dark py-1 text-dark text-decoration-none" href="/login">Login</a>
					<?php endif ?>
				</nav>
			</div>

			<div class="pricing-header p-3 pb-md-4 mx-auto text-center">
				<h1 class="display-4 fw-normal">Guido around the world.</h1>
				<p class="fs-5 text-muted">Panoramas are really inexpensive and simple way to explore a place, but it's a bit lonely without a guide.<br/>
			What a boring webside design though.</p>
			</div>
		</header>

		<div class="row row-cols-1 row-cols-sm-2 row-cols-md-3 g-3">
			<div class="col">
				<div class="card shadow-sm">
					<img src="datasets/miracoli/thumb.jpg" title="Piazza dei Miracoli"/>
					<div class="card-body">
			  			<p class="card-text">Piazza dei Miracoli, including a walk on the wall. Bonus view of other sightseeing Pisa.</p>
			  			<div class="d-flex justify-content-between align-items-center">
							<div class="btn-group">
								<a href="tours/miracoli" class="btn btn-sm btn-outline-secondary">View</a>
								<a href="tours/miracoli?role=guide" class="btn btn-sm btn-outline-secondary">Guide</a>
							</div>
							<small class="text-muted">9 mins</small>
						</div>
					</div>
				</div>
			</div>

			<div class="col">
				<div class="card shadow-sm">
					<img src="datasets/lucca/thumb.jpg" title="Lucca"/>
					<div class="card-body">
			  			<p class="card-text">Lucca.</p>
			  			<div class="d-flex justify-content-between align-items-center">
							<div class="btn-group">
								<a href="tours/lucca" class="btn btn-sm btn-outline-secondary">View</a>
								<a href="tours/lucca?role=guide" class="btn btn-sm btn-outline-secondary">Guide</a>
							</div>
							<small class="text-muted">9 mins</small>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>




	<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/js/bootstrap.bundle.min.js" integrity="sha384-MrcW6ZMFYlzcLA8Nl+NtUVF0sA7MsXsP1UyJoMp4YLEuNSfAP+JcXn/tWtIaxVXM" crossorigin="anonymous"></script>
  </body>
</html>
