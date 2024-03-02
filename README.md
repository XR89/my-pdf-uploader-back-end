## Setup Instructions

Follow these steps to set up the project:

1. **Environment Variables:**
   - Create a `.env` file in the root directory of your project.
   - Add your `PORT` and `MONGO_URI` to the `.env` file. Your `MONGO_URI` should follow the MongoDB connection string format and contain with your actual MongoDB credentials and host information.
     ```
     mongodb+srv://[username:password@]host[/[defaultauthdb][?options]]
     ```

2. **Node Version:**
   - Ensure you are using the latest version of Node.js. This project may not work with older versions.

3. **Dependencies:**
   - Run the following command to install the necessary dependencies:
     ```bash
     yarn install
     ```

4. **Starting the Application:**
   - Use the following command to compile and start the program:
     ```bash
     yarn dev
     ```


