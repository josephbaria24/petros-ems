# Grant petros-ems (or the TMS Azure app) access to Teams attendance reports.
# Run in Teams PowerShell as a Teams administrator after API permissions are granted.
#
# Install-Module MicrosoftTeams -Force
# Connect-MicrosoftTeams
#
# Replace CLIENT_ID with the Application (client) ID from Entra > App registrations.

$ClientId = "CLIENT_ID"

New-CsApplicationAccessPolicy -Identity "TMS-Teams-Attendance" -AppIds $ClientId -Description "Allow TMS to read Teams attendance reports"

# Tenant-wide (simplest for training staff who organize meetings):
Grant-CsApplicationAccessPolicy -PolicyName "TMS-Teams-Attendance" -Global

# Or grant only to specific organizers (object IDs from Entra > Users):
# Grant-CsApplicationAccessPolicy -PolicyName "TMS-Teams-Attendance" -Identity "ORGANIZER_OBJECT_ID"
