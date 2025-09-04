import fetch from 'node-fetch';

const API_BASE = 'http://localhost:5201/api';

async function checkUsers() {
  try {
    console.log('Verificando usuários no sistema...');
    
    // Fazer login primeiro
    const loginResponse = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });
    
    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status}`);
    }
    
    const cookies = loginResponse.headers.get('set-cookie');
    console.log('Login realizado com sucesso');
    
    // Buscar usuários
    const usersResponse = await fetch(`${API_BASE}/users`, {
      headers: {
        'Cookie': cookies
      }
    });
    
    if (!usersResponse.ok) {
      throw new Error(`Failed to fetch users: ${usersResponse.status}`);
    }
    
    const users = await usersResponse.json();
    console.log('Usuários encontrados:');
    users.forEach(user => {
      console.log(`ID: ${user.id}, Username: ${user.username}, Role: ${user.role}`);
    });
    
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

checkUsers();