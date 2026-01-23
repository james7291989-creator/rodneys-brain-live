#!/usr/bin/env python3

import requests
import sys
import json
import time
from datetime import datetime

class RodneysBrainAPITester:
    def __init__(self, base_url="https://webapp-wizard-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_base = f"{base_url}/api"
        self.token = None
        self.user_id = None
        self.test_project_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_result(self, test_name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {test_name}")
        else:
            print(f"❌ {test_name} - {details}")
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })

    def make_request(self, method, endpoint, data=None, expect_status=200):
        """Make API request with proper headers"""
        url = f"{self.api_base}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)
            else:
                return False, {"error": f"Unsupported method: {method}"}

            success = response.status_code == expect_status
            
            try:
                response_data = response.json()
            except:
                response_data = {"raw_response": response.text}

            return success, response_data

        except requests.exceptions.RequestException as e:
            return False, {"error": str(e)}

    def test_health_check(self):
        """Test basic health endpoints"""
        print("\n🔍 Testing Health Endpoints...")
        
        # Test root endpoint
        success, data = self.make_request('GET', '')
        self.log_result("Root endpoint", success, 
                       "" if success else f"Status: {data}")
        
        # Test health endpoint
        success, data = self.make_request('GET', 'health')
        self.log_result("Health endpoint", success,
                       "" if success else f"Status: {data}")

    def test_auth_flow(self):
        """Test complete authentication flow"""
        print("\n🔍 Testing Authentication Flow...")
        
        # Generate unique test user
        timestamp = datetime.now().strftime('%H%M%S')
        test_email = f"test_user_{timestamp}@example.com"
        test_password = "TestPass123!"
        test_name = f"Test User {timestamp}"

        # Test user registration
        register_data = {
            "email": test_email,
            "password": test_password,
            "name": test_name
        }
        
        success, data = self.make_request('POST', 'auth/register', register_data, 200)
        if success and 'token' in data:
            self.token = data['token']
            self.user_id = data['user']['id']
            self.log_result("User registration", True)
        else:
            self.log_result("User registration", False, f"Response: {data}")
            return False

        # Test duplicate registration (should fail)
        success, data = self.make_request('POST', 'auth/register', register_data, 400)
        self.log_result("Duplicate registration prevention", success,
                       "" if success else f"Should return 400, got: {data}")

        # Test login with correct credentials
        login_data = {
            "email": test_email,
            "password": test_password
        }
        
        success, data = self.make_request('POST', 'auth/login', login_data, 200)
        if success and 'token' in data:
            self.token = data['token']  # Update token
            self.log_result("User login", True)
        else:
            self.log_result("User login", False, f"Response: {data}")

        # Test login with wrong credentials
        wrong_login = {
            "email": test_email,
            "password": "wrongpassword"
        }
        
        success, data = self.make_request('POST', 'auth/login', wrong_login, 401)
        self.log_result("Invalid login rejection", success,
                       "" if success else f"Should return 401, got: {data}")

        # Test get current user
        success, data = self.make_request('GET', 'auth/me', None, 200)
        if success and data.get('email') == test_email:
            self.log_result("Get current user", True)
        else:
            self.log_result("Get current user", False, f"Response: {data}")

        return True

    def test_projects_crud(self):
        """Test project CRUD operations"""
        print("\n🔍 Testing Project CRUD Operations...")
        
        if not self.token:
            self.log_result("Projects CRUD", False, "No auth token available")
            return False

        # Test create project
        project_data = {
            "name": "Test Todo App",
            "prompt": "Create a simple todo app with add, delete, and mark complete functionality"
        }
        
        success, data = self.make_request('POST', 'projects', project_data, 200)
        if success and 'id' in data:
            self.test_project_id = data['id']
            self.log_result("Create project", True)
        else:
            self.log_result("Create project", False, f"Response: {data}")
            return False

        # Test list projects
        success, data = self.make_request('GET', 'projects', None, 200)
        if success and isinstance(data, list) and len(data) > 0:
            self.log_result("List projects", True)
        else:
            self.log_result("List projects", False, f"Response: {data}")

        # Test get specific project
        success, data = self.make_request('GET', f'projects/{self.test_project_id}', None, 200)
        if success and data.get('id') == self.test_project_id:
            self.log_result("Get project by ID", True)
        else:
            self.log_result("Get project by ID", False, f"Response: {data}")

        # Test update project
        update_data = {
            "name": "Updated Todo App",
            "files": {"index.html": "<html><body>Test</body></html>"}
        }
        
        success, data = self.make_request('PATCH', f'projects/{self.test_project_id}', update_data, 200)
        if success and data.get('name') == "Updated Todo App":
            self.log_result("Update project", True)
        else:
            self.log_result("Update project", False, f"Response: {data}")

        return True

    def test_code_generation(self):
        """Test code generation endpoint (SSE)"""
        print("\n🔍 Testing Code Generation...")
        
        if not self.token or not self.test_project_id:
            self.log_result("Code generation", False, "Missing token or project ID")
            return False

        # Test code generation endpoint
        generate_data = {
            "project_id": self.test_project_id,
            "prompt": "Create a simple todo app with HTML, CSS, and JavaScript"
        }
        
        url = f"{self.api_base}/generate"
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.token}'
        }
        
        try:
            response = requests.post(url, json=generate_data, headers=headers, 
                                   stream=True, timeout=30)
            
            if response.status_code == 200:
                # Check if we get SSE data
                events_received = 0
                for line in response.iter_lines(decode_unicode=True):
                    if line.startswith('data: '):
                        events_received += 1
                        if events_received >= 3:  # Got some events
                            break
                
                if events_received > 0:
                    self.log_result("Code generation SSE", True)
                else:
                    self.log_result("Code generation SSE", False, "No SSE events received")
            else:
                self.log_result("Code generation SSE", False, 
                               f"Status: {response.status_code}")
                
        except Exception as e:
            self.log_result("Code generation SSE", False, f"Error: {str(e)}")

    def test_preview_endpoint(self):
        """Test preview endpoint"""
        print("\n🔍 Testing Preview Endpoint...")
        
        if not self.test_project_id:
            self.log_result("Preview endpoint", False, "No project ID available")
            return False

        success, data = self.make_request('GET', f'preview/{self.test_project_id}', None, 200)
        if success and 'preview_html' in data:
            self.log_result("Preview endpoint", True)
        else:
            self.log_result("Preview endpoint", False, f"Response: {data}")

    def test_project_deletion(self):
        """Test project deletion (cleanup)"""
        print("\n🔍 Testing Project Deletion...")
        
        if not self.token or not self.test_project_id:
            self.log_result("Delete project", False, "Missing token or project ID")
            return False

        success, data = self.make_request('DELETE', f'projects/{self.test_project_id}', None, 200)
        if success:
            self.log_result("Delete project", True)
        else:
            self.log_result("Delete project", False, f"Response: {data}")

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting RodneysBrain API Tests...")
        print(f"Testing against: {self.base_url}")
        
        # Run tests in order
        self.test_health_check()
        
        if self.test_auth_flow():
            self.test_projects_crud()
            self.test_code_generation()
            self.test_preview_endpoint()
            self.test_project_deletion()
        
        # Print summary
        print(f"\n📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed < self.tests_run:
            print("\n❌ Failed Tests:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  - {result['test']}: {result['details']}")
        
        return self.tests_passed == self.tests_run

def main():
    tester = RodneysBrainAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())