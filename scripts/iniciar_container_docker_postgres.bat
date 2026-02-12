docker pull postgres

docker run --name local -e POSTGRES_PASSWORD=master2025 -e POSTGRES_DB=compras -p 5432:5432 -d postgres
