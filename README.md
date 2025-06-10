# FriendMesh

A simplified social media platform built by "Cool Team Name" with React and Supabase for the really cool Professfor and CSS 481 class project at UW Bothell.

## Project Structure
- `friendmesh/`: React application with Supabase integration (runs on `http://localhost:3000`)

## Getting Started
Visit [friendmesh.vercel.app](https://friendmesh.vercel.app) or follow the setup instructions below to run locally.

## Setup Instructions
1. **Clone the Repository**:
   ```bash
   git clone https://github.com/KyleDobyns/friendmesh.git
   cd friendmesh
   ```

2. **Install Dependencies**:
   - Navigate to the project directory:
     ```bash
     cd friendmesh
     npm install
     ```

3. **Supabase Setup**:
   - Sign up at [Supabase](https://supabase.com).
   - Create a new project and obtain `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
   - Create a `.env` file in the `friendmesh` directory:
     ```
     REACT_APP_SUPABASE_URL=your-supabase-url
     REACT_APP_SUPABASE_ANON_KEY=your-supabase-anon-key
     ```
   - **Important**: Never commit `.env` to the repository.

4. **Start the Application**:
   - From the `friendmesh` directory:
     ```bash
     npm start
     ```
   - Opens `http://localhost:3000` (React app).

5. **Install Git**:
   - Make sure Git is installed:
     ```bash
     git --version
     ```
   - Configure your Git username and email:
     ```bash
     git config --global user.name "Your Name"
     git config --global user.email "your.email@example.com"
     ```

## Development
- **Supabase Client**: Configure Supabase connection in `friendmesh/src/supabaseClient.js`.
- **Database**: Configure Supabase tables via the Supabase dashboard.

## Testing Tips
- **Debugging**:
  - Check the browser console for React errors.
  - Monitor the Network tab in browser DevTools for Supabase API calls.
  - Use Supabase dashboard to verify database operations.
- **Port Conflicts**: If `localhost:3000` is in use, stop other processes or the port will be automatically incremented.

## Troubleshooting
- **Command not working?** Make sure you're in the `friendmesh/` directory and ran `npm install`.
- **Supabase connection errors?** Verify your `.env` file has the correct keys and they start with `REACT_APP_`.
- **Can't push changes?** Verify you've accepted the collaborator invitation.
- **Application not loading?** Check the browser console for errors and ensure Supabase project is active.

## License
MIT License
