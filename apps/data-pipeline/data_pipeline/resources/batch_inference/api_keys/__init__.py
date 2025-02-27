from google.auth.transport.requests import Request
from google.oauth2 import service_account
from json_repair import repair_json

# Module-level variable for caching credentials
_gemini_credentials = None


def get_gemini_api_key(service_account_json: str) -> str:
    """Get a Google OAuth token using the service account JSON credentials."""
    global _gemini_credentials

    # Use cached credentials if available
    if _gemini_credentials is None:
        # Parse the JSON
        service_account_info = repair_json(service_account_json, return_objects=True)

        # Create credentials
        _gemini_credentials = service_account.Credentials.from_service_account_info(
            service_account_info,
            scopes=[
                "https://www.googleapis.com/auth/cloud-platform"
            ],  # Adjust scopes as needed
        )
        _gemini_credentials.refresh(Request())

    # Ensure token is valid
    if _gemini_credentials.expired:
        _gemini_credentials.refresh(Request())

    # Return the token
    return _gemini_credentials.token
