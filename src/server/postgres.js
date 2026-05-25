const pg = require("pg");
const dotenv = require("dotenv");
const crypto = require("crypto");
const dayjs = require("dayjs");
dotenv.config();

const pool = new pg.Pool({
    user: process.env.POSTGRES_USER,
    host: process.env.POSTGRES_HOST,
    database: process.env.POSTGRES_DB,
    password: process.env.POSTGRES_PASSWORD,
    port: process.env.POSTGRES_PORT
});

async function query(query, values){
    return new Promise(async (resolve, reject) => {
        const client = await pool.connect();
        try{
            const response = await client.query(query, values);
            resolve(response);
        }catch(error){
            resolve({error: error});
        }
        client.release();
    });
}

// Pasipo Database
async function addAlbum(album){
    const album_query = 
      `INSERT INTO albums(id, name, image, url, artists, genres, track_list, release_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO NOTHING`;

    const album_values = [   
            album.id, 
            album.name,
            album.image,
            album.url,
            album.artists,
            album.genres, 
            album.track_list,
            album.release_date];
    
    query(album_query, album_values);
}

async function getAlbum(album_id){
    const album = await query("SELECT * FROM albums WHERE id=$1", [album_id]);
    return album.rows.length > 0 ? album.rows[0] : {error: `No album found for id ${album_id}.`};
}

async function refreshAlbums(refreshed_albums){
    const truncate = await query("TRUNCATE albums");
    if(!truncate.error){
        refreshed_albums.forEach( album => { addAlbum(album); });
    }
}

async function getAlbumIds(service){
    const albums = await query("SELECT id FROM albums");
    let album_ids = [];

    if(albums.rows.length > 0){
        let album_set = [];
        for(let i = 0; i < albums.rows.length; i++){
            album_set.push(albums.rows[i].id);
            if((i + 1) % 20 == 0){
                album_ids.push(album_set);
                album_set = [];
            }
        }
        album_ids.push(album_set);
    }
    return album_ids;
}

// Album/rating info of another user
async function getViewedUser(viewed_user, current_user){

    if(viewed_user === current_user){
        return {is_current_user: true, user_name: viewed_user};
    }

    const user_check = await query("SELECT * from users WHERE user_name = $1", [viewed_user]);
    if(user_check.rows.length != 0){
        const found_user = user_check.rows[0];
        const found_albums = await pullUserAlbums(found_user) || [];
        const found_ratings = await pullUserRatings(found_user) || [];
        const viewed_albums = {};
        const viewed_ratings = {};

        found_albums.forEach(found_album => {
            viewed_albums[dayjs(found_album.date).format("MMM DD, YYYY")] = found_album.album_id; 
        });

        found_ratings.forEach(found_rating => {
            viewed_ratings[found_rating.album_id] = found_rating.rating;
        });

        return {
                user_name: viewed_user,
                profile_name: found_user.profile_name,
                albums: viewed_albums,
                ratings: viewed_ratings
               };
    }else{
        return {error: `User "${viewed_user}" does not exist.`};
    }
}

// User daily album info
async function pullUserAlbums(user){
    const albums = await query("SELECT * FROM pasipo WHERE user_id = $1", [user.user_id]);
    return albums.rows;
}

async function pushUserAlbums(user, data){
    if(!data.user_albums){ return {error: "No albums provided for user album push."}; } 
        
    const conflicts = [];

    data.user_albums.forEach(async(album) =>{
        const insert = await addUserAlbum(user, album);
        if(insert.conflict){
            conflicts.push(insert.conflict);
        }
    });

    if(conflicts.length > 0){
        return {error: "One or more local albums had conflicts with remote albums.", conflicts: conflicts};
    }else{
        return {success: `Albums have be pushed with no conflicts.`};
    }
}

async function addUserAlbum(user, data){
    if(!data.date){ return {error: "No date provided for user album addition."}; }
    if(!data.id){ return {error: "No album provided for user album addition."}; }
    const conflict = await query("SELECT album_id FROM pasipo WHERE (user_id, date) = ($1, $2)", [user.user_id, data.date])
        
    if(conflict.rows[0] && conflict.rows[0].album_id !== data.id){
        return {error: `Album already exists for date ${data.date}.`,
                conflict: {date: data.date, local: data.id, remote: conflict.rows[0].album_id}}
    }else{
        await query(`INSERT INTO pasipo(user_id, date, album_id) VALUES ($1, $2, $3)`, [user.user_id, data.date, data.id]);
        return {success: `Album ${data.id} is added for date ${data.date}.`};
    }
}

async function updateUserAlbum(user, data){
    if(!data.date){ return {error: "No date provided for user album update."}; }
    if(!data.id){ return {error: "No album provided for user album update."}; }
    // if(!data.notes) { return {error: "No notes provided for user album update."}; }
    deleteUserAlbum(user, data);
    return addUserAlbum(user, data);
}

async function deleteUserAlbum(user, data){
    if(!data.date){ return {error: "No date provided for user album deletion."}; }
    query("DELETE FROM pasipo WHERE user_id=$1 AND date=$2", [user.user_id, data.date]);
    return {success: `Album is removed for date ${data.date}.`}
}

// User rating info
async function updateUserRating(user, data){
    if(!data.id){ return {error: "No album provided for user rating update."}; }
    const position = data.position || 0;
    const ratings_query = await query("SELECT * FROM ratings WHERE user_id=$1 AND album_id=$2", [user.user_id, data.id]);
    const ratings = ratings_query.rows[0] || null;
    const rating = ratings ? ratings.rating : [];

    // This will eventually update the rating of the album among all users.
    if(position == 0){
        rating_change = rating[position] ? rating[position] - data.rating : null;
    }

    rating[position] = data.rating;

    query(`INSERT INTO ratings(user_id, album_id, rating) VALUES ($1, $2, $3)
            ON CONFLICT (user_id, album_id)
            DO UPDATE SET rating = EXCLUDED.rating`,
            [user.user_id, data.id, rating]);

    return {success: "Rating updated successfully."};
}

async function pushUserRatings(user, data){
    if(!data.user_ratings){ return {error: "No ratings provided for user ratings push."}; } 
    
    data.user_ratings.forEach(async(user_rating) => {
       updateUserRating(user, user_rating);
    });
}

async function pullUserRatings(user){
    const albums = await query("SELECT * FROM ratings WHERE user_id = $1", [user.user_id]);
    return albums.rows;
}

// User Authorization
async function hashPassword(pass_word, salt, length){
    return new Promise((resolve, reject) => {
        crypto.scrypt(pass_word, salt, length, (err, hashed_pass_word) => {
            resolve(hashed_pass_word);
        });
    });
}

async function signup(user_name, pass_word, pass_confirm){
    user_name = user_name.toLowerCase();
    if(pass_word !== pass_confirm){
        return {error: "Passwords do not match.", error_type:"password"}
    }
    
    const salt = crypto.randomBytes(16);

    const hashed_pass_word = await hashPassword(pass_word, salt, 64);

    const signup = await query("INSERT INTO users(user_name, hashed_pass_word, salt, profile_name, tokens) VALUES ($1, $2, $3, $4, $5)",
                        [user_name, hashed_pass_word, salt, user_name, {}]);

    if(signup.error){
        return {error: `Username is already taken.`, error_type:"user"}
    }

    return await login(user_name, pass_word);
}

async function login(user_name, pass_word){ 
    user_name = user_name.toLowerCase();
    const users = await query("SELECT * FROM users WHERE user_name = $1", [user_name]);
    if(!users.rows || !users.rows[0]) { return {error: `User ${user_name} not found.`, error_type:"user"} };

    const user = users.rows[0];

    const hashed_pass_word = await hashPassword(pass_word, user.salt, 64);
    if(crypto.timingSafeEqual(hashed_pass_word, user.hashed_pass_word)){
        return user;
    }else{
        return {error: `Incorrect password.`, error_type:"password"};
    }
}

async function refreshUser(user_id){
    const user = await query("SELECT * FROM users WHERE user_id=$1", [user_id]); 
    return user.rows.length > 0 ? user.rows[0] : {error: `User does not exist.`, error_type:"user"};
}

async function userWithServiceExists(service, service_id){
    const check = await query(`SELECT * FROM users WHERE ${service}_id=$1`, [service_id]);
    if(check.error){ return false; }
    return (check.rows.length > 0);
}

async function setToken(user_info){
    if(!user_info){ return; }

    const service = user_info.service // Music services (Spotify, Apple Music, YT Music, etc.)
    if(!["spotify", "apple", "youtube"].includes(service)) { return; }

    const user = await refreshUser(user_info.user_id);
    if(user.error) { return; }

    const conflict = await userWithServiceExists(service, user_info.service_id);

    // User.tokens could be empty when a user is first created in the database,
    // so we account for that and create a new json object for the tokens if it's null
    // otherwise we just add the current service's token to the set of tokens.
    if(!conflict){

        if(!user.tokens){ 
            user.tokens = {[service] : user_info.service_token} 
        } else if(!user.tokens[`${service}`]){
            user.tokens[`${service}`] = user_info.service_token; 
        }

        // User.urls might be empty as well, so do the same.
        if(!user.urls){
            user.urls = {[service] : user_info.service_url}
        }else if(!user.urls[`${service}`]){
            user.urls[`${service}`] = user_info.service_url;
        }

        // This just adds the service's values if the user doesn't already have them.
        if(!user.email){ user.email = user_info.service_email; }
        if(!user.profile_image){ user.profile_image = user_info.service_image; }
        if(!user.profile_name){ user.profile_name = user_info.service_profile_name; }
        if(!user[`${service}_id`]){ user[`${service}_id`] = user_info.service_id; }

        await query(
            `UPDATE users 
                SET user_email=$1,
                    profile_name=$2,
                    profile_image=$3,
                    ${service}_id=$4,
                    tokens=$5,
                    urls=$6
                WHERE user_id=$7`,
            [user.email, user.profile_name, user.profile_image,
             user[`${service}_id`], user.tokens, user.urls, user.user_id]
        );
    }
}

async function loginToken(user_info){
    const login = await query(`SELECT * FROM users WHERE ${user_info.service}_id=$1`, [user_info.service_id]);
    return (login.rows && (login.rows.length > 0)) ? login.rows[0] : {error: `No user with given ${user_info.service} id found.`};
}

async function signupToken(user_info){
    // const check = await loginToken(user_info);
    // if(!check.error) { return };

    const signup = await query(
        `INSERT INTO users(user_name, user_email, profile_name,
            ${user_info.service}_id, profile_image, urls, tokens) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [`user${performance.now().toString().split(".")[1]}`,
         user_info.service_email,
         user_info.service_profile_name,
         user_info.service_id,
         user_info.service_image,
         {[user_info.service] : user_info.service_url},
         {[user_info.service] : user_info.service_token}]);

    return signup.error ? {error: "Failed to create user."} : {success: "User created."};
}

module.exports = {
    pool, 
    addAlbum, getAlbum,
    getAlbumIds, refreshAlbums,
    getViewedUser,
    pullUserAlbums, pushUserAlbums, 
    addUserAlbum, updateUserAlbum, deleteUserAlbum,
    pullUserRatings, pushUserRatings, updateUserRating,
    query, signup, login, refreshUser,
    setToken, loginToken, signupToken
};
