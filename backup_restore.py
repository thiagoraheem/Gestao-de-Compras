import os
import subprocess
import tempfile
import sys
from urllib.parse import urlparse
import shutil

def find_pg_command(command):
    if shutil.which(command):
        return command
    
    if os.name == 'nt':
        common_paths = [
            r"C:\Program Files\PostgreSQL\17\bin",
            r"C:\Program Files\PostgreSQL\16\bin",
            r"C:\Program Files\PostgreSQL\15\bin",
            r"C:\Program Files\PostgreSQL\14\bin",
            r"C:\Program Files\PostgreSQL\13\bin",
            r"C:\Program Files\PostgreSQL\12\bin",
            r"C:\Program Files (x86)\PostgreSQL\17\bin",
            r"C:\Program Files (x86)\PostgreSQL\16\bin",
            r"C:\Program Files (x86)\PostgreSQL\15\bin",
            r"C:\Program Files (x86)\PostgreSQL\14\bin",
            r"C:\Program Files (x86)\PostgreSQL\13\bin",
        ]
        for path in common_paths:
            full_path = os.path.join(path, command + ".exe")
            if os.path.exists(full_path):
                os.environ['PATH'] = path + os.pathsep + os.environ.get('PATH', '')
                return command
        
        for path in common_paths:
            full_path = os.path.join(path, command + ".exe")
            if os.path.exists(full_path):
                os.environ['PATH'] = path + os.pathsep + os.environ.get('PATH', '')
                return command
    
    raise FileNotFoundError(f"{command} not found. Install PostgreSQL or add it to PATH")

def get_db_config_from_url(url):
    parsed = urlparse(url)
    return {
        'host': parsed.hostname,
        'port': parsed.port or 5432,
        'database': parsed.path.lstrip('/'),
        'user': parsed.username,
        'password': parsed.password
    }

def load_env_file(env_path='.env'):
    env_vars = {}
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    env_vars[key] = value.strip('"')
    return env_vars

def run_pg_dump(config, output_file):
    env = os.environ.copy()
    env['PGPASSWORD'] = config['password']
    
    cmd = [
        find_pg_command('pg_dump'),
        '-h', config['host'],
        '-p', str(config['port']),
        '-U', config['user'],
        '-d', config['database'],
        '-Fc',
        '-f', output_file
    ]
    
    result = subprocess.run(cmd, env=env, capture_output=True, text=True, shell=True)
    if result.returncode != 0:
        raise Exception(f"pg_dump failed: {result.stderr}")
    print(f"Backup created: {output_file}")

def run_pg_restore(config, input_file):
    env = os.environ.copy()
    env['PGPASSWORD'] = config['password']
    
    cmd = [
        find_pg_command('pg_restore'),
        '-h', config['host'],
        '-p', str(config['port']),
        '-U', config['user'],
        '-d', config['database'],
        '--clean',
        '--if-exists',
        '-c',
        input_file
    ]
    
    result = subprocess.run(cmd, env=env, capture_output=True, text=True, shell=True)
    if result.returncode != 0:
        raise Exception(f"pg_restore failed: {result.stderr}")
    print("Database restored successfully")

def main():
    env_vars = load_env_file('.env')
    
    prd_url = env_vars.get('DATABASE_URL_PRD')
    if not prd_url:
        print("Error: DATABASE_URL_PRD not found in .env file")
        sys.exit(1)
    
    dev_url = env_vars.get('DATABASE_URL_DEV')
    if not dev_url:
        print("Error: DATABASE_URL_DEV not found in .env file")
        sys.exit(1)
    
    prd_config = get_db_config_from_url(prd_url)
    dev_config = get_db_config_from_url(dev_url)
    
    print(f"Backup source: {prd_config['host']}/{prd_config['database']}")
    print(f"Restore target: {dev_config['host']}/{dev_config['database']}")
    
    with tempfile.NamedTemporaryFile(suffix='.backup', delete=False) as tmp_file:
        backup_file = tmp_file.name
    
    try:
        run_pg_dump(prd_config, backup_file)
        run_pg_restore(dev_config, backup_file)
    finally:
        if os.path.exists(backup_file):
            os.remove(backup_file)
            print("Temporary backup file removed")

if __name__ == '__main__':
    main()