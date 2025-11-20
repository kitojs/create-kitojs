import { server } from "kitojs";

const app = server();

app.get("/", ({ res }) => {
    res.send("Hello, World!");
});

app.listen(3000, () => {
    console.log("Server is running on http://localhost:3000");
});