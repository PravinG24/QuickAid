const quickAidIsLocalHost = ["localhost", "127.0.0.1"].includes(String(window.location.hostname || "").toLowerCase());
window.QUICKAID_API_BASE =
	window.QUICKAID_API_BASE || (quickAidIsLocalHost ? "http://localhost:7071" : "https://quickaid-functions.azurewebsites.net");
window.QUICKAID_FUNCTION_KEY = window.QUICKAID_FUNCTION_KEY || "";
window.QUICKAID_ENTRA_TENANT_ID = window.QUICKAID_ENTRA_TENANT_ID || "4f8311db-1cf6-4e90-850e-85c68f716efd";
window.QUICKAID_ENTRA_CLIENT_ID = window.QUICKAID_ENTRA_CLIENT_ID || "b19ae468-e969-4c94-830d-c848533f3979";
window.QUICKAID_ENTRA_API_AUDIENCE = window.QUICKAID_ENTRA_API_AUDIENCE || "api://2992ace2-9cb6-49b7-a365-904871ea0f4b";
window.QUICKAID_ENTRA_API_SCOPE =
	window.QUICKAID_ENTRA_API_SCOPE || `${window.QUICKAID_ENTRA_API_AUDIENCE}/access_as_user`;
window.QUICKAID_ENTRA_REDIRECT_URI = window.QUICKAID_ENTRA_REDIRECT_URI || `${window.location.origin}/login.html`;
