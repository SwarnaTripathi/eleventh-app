Add-Type -AssemblyName 'System.IO.Compression.FileSystem'
$zip = [System.IO.Compression.ZipFile]::OpenRead('e:\vibe2ship\Vibe2Ship - Problem Statements & Submission Guidelines.docx')
$allText = @()
foreach ($entry in $zip.Entries) {
    if ($entry.FullName -match '\.xml$') {
        $stream = $entry.Open()
        $reader = New-Object System.IO.StreamReader($stream)
        $content = $reader.ReadToEnd()
        $reader.Close()
        $stream.Close()
        try {
            $xml = [xml]$content
            $ns = @{w='http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
            $texts = Select-Xml -Xml $xml -XPath '//w:t' -Namespace $ns | ForEach-Object { $_.Node.InnerText }
            if ($texts) {
                $allText += "=== $($entry.FullName) ==="
                $allText += ($texts -join ' ')
                $allText += ""
            }
        } catch {}
    }
}
$zip.Dispose()
$allText | Out-File 'e:\vibe2ship\app\guidelines_complete.txt' -Encoding UTF8
