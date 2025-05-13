# FriendMesh

A simplified social media platform built by Cool Team Name with React (frontend), Node.js (backend), and Supabase (database/auth) for a class project.

## Project Structure
- `client/`: React frontend (runs on `http://localhost:3000`)
- `server/`: Node.js/Express backend (runs on `http://localhost:5000`)
- `config/`: Configuration files (e.g., Supabase)

## Setup Instructions
1. **Clone the Repository**:
   ```bash
   git clone https://github.com/KyleDobyns/friendmesh.git
   cd friendmesh
   ```

2. **Install Frontend Dependencies**:
   - Navigate to the `client` directory:
     ```bash
     cd client
     npm install
     ```

3. **Install Backend Dependencies**:
   - Navigate to the `server` directory:
     ```bash
     cd ../server
     npm install
     ```

4. **Start the Frontend**:
   - In a terminal, from the `client` directory:
     ```bash
     cd client
     npm start
     ```
   - Opens `http://localhost:3000` (React app).
   - Use this terminal to monitor frontend logs for UI or React errors.

5. **Start the Backend**:
   - In a **separate terminal**, from the `server` directory:
     ```bash
     cd server
     npm start
     ```
   - Runs at `http://localhost:5000` (Node.js API).
   - Use this terminal to monitor backend logs for API or Supabase errors.

6. **Supabase Setup**:
   - Sign up at [Supabase](https://supabase.com).
   - Create a new project and obtain `SUPABASE_URL` and `SUPABASE_KEY`.
   - Add them to `server/.env`:
     ```
     SUPABASE_URL=your-supabase-url
     SUPABASE_KEY=your-supabase-key
     ```
   - **Important**: Never commit `.env` to the repository.

7. **Install Git**:
   - Ensure Git is installed:
     ```bash
     git --version
     ```
   - Configure your Git username and email:
     ```bash
     git config --global user.name "Your Name"
     git config --global user.email "your.email@example.com"
     ```

## Development
- **Frontend**: Add React components in `client/src/components/`.
- **Backend**: Add API routes in `server/routes/`.
- **Database**: Configure Supabase tables via the Supabase dashboard.

## Testing Tips
- **Why Separate Terminals?** Running frontend and backend separately makes it easier to spot errors:
  - Frontend logs (`client`) show React or UI issues (component rendering errors).
  - Backend logs (`server`) show API or Supabase issues (database connection errors).
- **Debugging**:
  - Test the frontend alone by running only `client/npm start`.
  - Test the backend alone with `server/npm start`.
- **Port Conflicts**: If `localhost:3000` or `localhost:5000` are in use, stop other processes or change ports in `client/.env` (frontend) or `server/index.js` (backend).

## Team Collaboration
- **Collaborator Access**: Accept your GitHub collaborator invitation to push changes.
- **Branching**: Create branches for features:
  ```bash
  git checkout -b feature-name
  ```
- **Pushing**: Push changes to GitHub:
  ```bash
  git push origin branch-name
  ```
- **Pull Requests**: Create pull requests for code reviews before merging to `main`.


## Public Repository Notice
- This repository is public and visible to everyone.
- Make sure no sensitive data (e.g., `.env` files, Supabase keys) is committed.

## Troubleshooting
- **Command not working?** Make sure you’re in the correct directory (`client/` for frontend, `server/` for backend) and ran `npm install`.
- **Errors in logs?** Check the terminal for the frontend or backend to identify the issue.
- **Can’t push changes?** Verify you’ve accepted the collaborator invitation.

## License
MIT License