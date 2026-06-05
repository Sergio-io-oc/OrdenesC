import https from 'https';

https.get('https://docs.google.com/spreadsheets/d/1z36YOIr9aVnGTu0GuVD63HY-QmOwzY9X/edit?usp=sharing', (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    // try to find the "activeSheetName" or "sheetNames" or just "gid"
    const regex = /"name":"([^"]+)","id":(\d+)/g;
    let match;
    while((match = regex.exec(body)) !== null) {
      console.log(`Found sheet: ${match[1]} -> gid: ${match[2]}`);
    }
  });
});
