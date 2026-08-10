import uvicorn
import os

if __name__ == "__main__":
    # Ensure the script runs from the backend directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    print("=========================================")
    print("🚀 Starting FastAPI Backend...")
    print("=========================================")
    
    # Run the uvicorn server programmatically
    uvicorn.run(
        "app.main:app", 
        host="0.0.0.0", 
        port=8000, 
        reload=True
    )
