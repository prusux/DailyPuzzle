export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
    const BIN_ID = process.env.JSONBIN_BIN_ID;
    const MASTER_KEY = process.env.JSONBIN_MASTER_KEY;
    
    if (!BIN_ID || !MASTER_KEY) {
        return new Response(JSON.stringify({ error: "KV DB not linked" }), { status: 500, headers: { 'content-type': 'application/json' } });
    }

    try {
        if (req.method === 'GET') {
            const response = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest?meta=false&t=${Date.now()}`, {
                headers: { "X-Master-Key": MASTER_KEY },
                cache: 'no-store'
            });
            
            const data = await response.json();
            
            let scores = [];
            if(data && data.record) {
                scores = Array.isArray(data.record) ? data.record : (data.record.scores || []);
            } else if (Array.isArray(data)) {
                scores = data;
            } else if (data && data.scores) {
                scores = data.scores;
            }
            
            return new Response(JSON.stringify(scores), {
                headers: { 
                    'content-type': 'application/json',
                    'Cache-Control': 'no-cache, no-store, must-revalidate'
                }
            });
        }
        
        if (req.method === 'POST') {
            const newScore = await req.json();
            
            const getRes = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest?meta=false&t=${Date.now()}`, {
                headers: { "X-Master-Key": MASTER_KEY },
                cache: 'no-store'
            });
            const getData = await getRes.json();
            
            let scores = [];
            if(getData && getData.record) {
                scores = Array.isArray(getData.record) ? getData.record : (getData.record.scores || []);
            } else if (Array.isArray(getData)) {
                scores = getData;
            } else if (getData && getData.scores) {
                scores = getData.scores;
            }
            
            scores.push(newScore);
            
            const putRes = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
                method: 'PUT',
                headers: { 
                    "X-Master-Key": MASTER_KEY,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(scores),
                cache: 'no-store'
            });
            
            if (!putRes.ok) {
                const errData = await putRes.text();
                return new Response(JSON.stringify({ error: "Failed PUT to JSONBin", details: errData }), { status: 500, headers: { 'content-type': 'application/json' } });
            }
            
            return new Response(JSON.stringify({ success: true }), {
                headers: { 
                    'content-type': 'application/json',
                    'Cache-Control': 'no-cache, no-store, must-revalidate'
                }
            });
        }
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'content-type': 'application/json' } });
    }
    
    return new Response('Method not allowed', { status: 405 });
}
