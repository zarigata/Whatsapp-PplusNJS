from fastapi import FastAPI, Request
import requests

app = FastAPI()

@app.post("/generate/")
async def generate_text(request: Request):
    # Parse the JSON data from the request body
    data = await request.json()
    prompt = data.get('prompt')  # Assuming the prompt is sent in the JSON body

    if not prompt:
        return {"error": "No prompt provided"}

    # Use Ollama to generate text based on the prompt
    response = requests.post(
        'http://localhost:11434/generate', 
        json={'model': 'llama3.1', 'prompt': prompt}
    )

    if response.status_code == 200:
        result = response.json()
        return {"generated_text": result['response']}
    else:
        return {"error": "Failed to generate text"}

# To run the server, use Uvicorn
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)