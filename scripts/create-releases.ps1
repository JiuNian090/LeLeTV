# Create GitHub Releases PowerShell Script
# Requires GitHub CLI: https://cli.github.com/

# Check if GitHub CLI is installed
if (!(Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "Error: GitHub CLI (gh command) not found"
    Write-Host "Please install GitHub CLI: https://cli.github.com/"
    exit 1
}

# Read CHANGELOG.md and extract version information
$changelogPath = "CHANGELOG.md"
$changelogContent = Get-Content $changelogPath -Raw

# Extract all versions using regex
$versionPattern = "### (v[\d\.]+) \(([\d\-:\s]+)\)([\s\S]*?)(?=(?:\n### |\Z))"
$versions = @()

# Find all matching versions
$matches = [regex]::Matches($changelogContent, $versionPattern)
foreach ($match in $matches) {
    $version = $match.Groups[1].Value
    $date = $match.Groups[2].Value
    $content = $match.Groups[3].Value.Trim()
    
    # Create version object
    $versionObj = @{
        tag = $version
        title = $version
        date = $date
        content = $content
    }
    
    $versions += $versionObj
}

Write-Host "Found $($versions.Count) historical versions"

# Create Release for each version
foreach ($versionObj in $versions) {
    Write-Host "Creating Release for tag $($versionObj.tag)..."
    
    # Construct Release notes with proper encoding
    $releaseNotes = "# Release $($versionObj.tag)`n`n## Update Content`n`n$($versionObj.content)`n`n---`n`nPublished at $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")"
    
    # Save Release notes to temporary file with UTF8 encoding
    $tempFile = [System.IO.Path]::GetTempFileName()
    [System.IO.File]::WriteAllText($tempFile, $releaseNotes, [System.Text.Encoding]::UTF8)
    
    # Create Release
    $cmd = "gh release create `"$($versionObj.tag)`" --title `"$($versionObj.title)`" --notes-file `"$tempFile`""
    Write-Host "Executing command: $cmd"
    
    try {
        Invoke-Expression $cmd
        Write-Host "Successfully created Release $($versionObj.tag)"
    } catch {
        Write-Host "Error creating Release $($versionObj.tag): $_"
    }
    
    # Delete temporary file
    Remove-Item $tempFile
    
    Write-Host "Completed Release creation for tag $($versionObj.tag)`n"
    Start-Sleep -Seconds 2  # Avoid API rate limiting
}

Write-Host "All Releases created successfully!"