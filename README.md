<a name="readme-top"></a>

<br />
<div align="center">
<h3 align="center">Pasipo</h3>

  <p align="center">
    A daily album listening tracker
    <br />
    <a href="https://github.com/gerselle/pasipo"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="https://github.com/gerselle/pasipo">View Demo</a>
    ·
    <a href="https://github.com/gerselle/pasipo/issues">Report Bug</a>
    ·
    <a href="https://github.com/gerselle/pasipo/issues">Request Feature</a>
  </p>
</div>

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
    <li><a href="#acknowledgments">Acknowledgments</a></li>
  </ol>
</details>



<!-- ABOUT THE PROJECT -->
## About The Project

<!-- [![Product Name Screen Shot][product-screenshot]](https://example.com) -->

A desktop and mobile responsive website written in pure HTML, JS and CSS and served with NodeJS and Express. Utilizes a PostgreSQL database to store user information, and implements Spotify's API to display and cache album data/images. With OAuth 2.0 authentication, Pasipo can create user defined playlists of albums for each year of listening on the user's Spotify account.

### Built With

* [![Node][Node.js]][Node-url]
* [![Express][Express.js]][Express-url]
* [![Postgres][Postgres]][Postgres-url]
* [![Spotify][Spotify]][Spotify-url]

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- GETTING STARTED -->
## Getting Started

This section will be updated in the future.

### Prerequisites

* Node.js (and npm)
* Docker + Docker Compose — only for the recommended path below
* A [Spotify developer app](https://developer.spotify.com/dashboard) (for the client ID/secret)

### Installation

Copy `.env.example` to `.env` and fill in the secrets (Spotify, Postgres password, cookie secret, Typesense API key).

#### Running with Docker (recommended for self-hosting)

`compose.yml` starts Postgres, Typesense, and the Node app, seeding the schema from `db/init.sql` on first boot.

```sh
docker compose up -d --build
```

#### Running standalone (bring your own Postgres and Typesense)

Point `.env` at your existing services (`POSTGRES_HOST`, `POSTGRES_PORT`, `TYPESENSE_HOST`, `TYPESENSE_PORT`, and friends — see `.env.example`). Apply the schema once against your Postgres, then start the app:

```sh
psql "$YOUR_CONNECTION_STRING" -f db/init.sql
npm install
npm start
```

### Project layout

* `src/server/` — Express app and the Postgres/Spotify/Typesense wrappers (`npm start` runs `src/server/app.js`)
* `src/client/` — static frontend (HTML/CSS/JS, templates, icons, player, vendored libs in `js/`)
* `db/init.sql` — canonical schema, used by both install paths
* `compose.yml` — Postgres + Typesense for the Docker path

<p align="right">(<a href="#readme-top">back to top</a>)</p>


<!-- USAGE EXAMPLES -->
## Usage

TBA

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- ROADMAP -->
## Roadmap

Planned features
- [ ] Homepage
  - [ ] General info/user guide
  - [ ] Login/signup section
  - [ ] Public user search
- [ ] User profile
  - [ ] Year List
    - [ ] Lists all months for selected year
  - [ ] Month Calendar
    - [ ] Portrait (vertical scroll) and landscape (5x7 grid) view
    - [ ] Album art is displayed in their respective day
  - [ ] Daily info
    - [ ] Album select
      - [ ] Album rating (1-10)
      - [ ] Notes for the entire album
      - [ ] Link to Spotify album 
    - [ ] Tracklist
      - [ ] Optional notes for each track

Potential additional features
- [ ] Spotify playlist editor (Only for Pasipo playlists)
- [ ] Recommendations/new releases  
- [ ] Ability to use other APIs (Apple/Amazon/YT music, etc.)
- [ ] Album wall grid planner
- Year List
    - [ ] Most listened to genre/s
    - [ ] Release year ranges
    - [ ] Top albums of that year (User ratings)
    - [ ] Total time listened per month
    - [ ] Global heatmap of artists 
- Tracklist
  - [ ] Relative ranking between each song
  - [ ] Music player (If logged in with Spotify)
  - [ ] If an album is playing, make the album cover spin like a record

See the [open issues](https://github.com/gerselle/pasipo/issues) for a full list of proposed features (and known issues).

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTRIBUTING -->
## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".
Don't forget to give the project a star! Thanks again!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- LICENSE -->
## License

Distributed under the MIT License. See `LICENSE.txt` for more information.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTACT -->
## Contact

Gerald Sellers - contact@gerselle.com

Project Link: [https://github.com/gerselle/pasipo](https://github.com/gerselle/pasipo)

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- ACKNOWLEDGMENTS -->
<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->
[contributors-shield]: https://img.shields.io/github/contributors/gerselle/pasipo.svg?style=for-the-badge
[contributors-url]: https://github.com/gerselle/pasipo/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/gerselle/pasipo.svg?style=for-the-badge
[forks-url]: https://github.com/gerselle/pasipo/network/members
[stars-shield]: https://img.shields.io/github/stars/gerselle/pasipo.svg?style=for-the-badge
[stars-url]: https://github.com/gerselle/pasipo/stargazers
[issues-shield]: https://img.shields.io/github/issues/gerselle/pasipo.svg?style=for-the-badge
[issues-url]: https://github.com/gerselle/pasipo/issues
[license-shield]: https://img.shields.io/github/license/gerselle/pasipo.svg?style=for-the-badge
[license-url]: https://github.com/gerselle/pasipo/blob/master/LICENSE.txt
[linkedin-shield]: https://img.shields.io/badge/-LinkedIn-black.svg?style=for-the-badge&logo=linkedin&colorB=555
[linkedin-url]: https://linkedin.com/in/gerselle
[product-screenshot]: images/screenshot.png



[Node.js]: https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white
[Node-url]: https://nodejs.org/en

[Express.js]: https://img.shields.io/badge/express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=%2361DAFB
[Express-url]: https://expressjs.com/

[Spotify]: https://img.shields.io/badge/Spotify-1ED760?style=for-the-badge&logo=spotify&logoColor=white
[Spotify-url]: https://developer.spotify.com/documentation/web-api

[Postgres]: https://img.shields.io/badge/postgres-%23316192.svg?style=for-the-badge&logo=postgresql&logoColor=white
[Postgres-url]: https://www.postgresql.org/