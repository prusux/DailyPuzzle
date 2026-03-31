export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
    const BIN_ID = "69cbe880aaba882197afc549";
    const MASTER_KEY = "$2a$10$IRUbqeg4/5madSiaobEJpOeRP.7NDnNf0uo2mpYPCv51U9cbMJ0lW";
    
    try {
        if (req.method === 'GET') {
            const response = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
                headers: { "X-Master-Key": MASTER_KEY }
            });
            const data = await response.json();
            
            let scores = [];
            if(data && data.record) {
                scores = Array.isArray(data.record) ? data.record : (data.record.scores || []);
            }
            
            return new Response(JSON.stringify(scores), {
                headers: { 'content-type': 'application/json' }
            });
        }
        
        if (req.method === 'POST') {
            const newScore = await req.json();
            
            const getRes = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
                headers: { "X-Master-Key": MASTER_KEY }
            });
            const getData = await getRes.json();
            
            let scores = [];
            if(getData && getData.record) {
                scores = Array.isArray(getData.record) ? getData.record : (getData.record.scores || []);
            }
            
            scores.push(newScore);
            
            await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
                method: 'PUT',
                headers: { 
                    "X-Master-Key": MASTER_KEY,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(scores) 
            });
            
            return new Response(JSON.stringify({ success: true }), {
                headers: { 'content-type': 'application/json' }
            });
        }
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'content-type': 'application/json' } });
    }
    
    return new Response('Method not allowed', { status: 405 });
}
