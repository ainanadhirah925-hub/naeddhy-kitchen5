
// ===================================
// NAEDDHY KITCHEN - API SETTINGS
// ===================================

const API = {
    mealDB: "https://www.themealdb.com/api/json/v1/1",
    edamam: "https://api.edamam.com/api/recipes/v2",
    cocktailDB: "https://www.thecocktaildb.com/api/json/v1/1"
};

// Edamam API keys
// Boleh dibiarkan kosong jika belum ada API key.
const EDAMAM_APP_ID = "";
const EDAMAM_APP_KEY = "";

let recipes = [];

// ===================================
// START WEBSITE
// ===================================

document.addEventListener("DOMContentLoaded", function () {

    const searchInput = document.getElementById("searchInput");
    const searchBtn = document.getElementById("searchBtn");
    const cocktailBtn = document.getElementById("cocktailBtn");

    searchBtn.addEventListener("click", searchRecipes);

    searchInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            searchRecipes();
        }
    });

    cocktailBtn.addEventListener("click", function () {
        searchCocktails();
    });

    document.querySelectorAll(".cuisine-card").forEach(card => {
        card.addEventListener("click", function () {
            searchCuisine(this.dataset.area);
        });
    });

    checkOpeningHours();
    setInterval(checkOpeningHours, 60000);
});


// ===================================
// COMMON ELEMENTS
// ===================================

function getElements() {
    return {
        searchInput: document.getElementById("searchInput"),
        searchBtn: document.getElementById("searchBtn"),
        recipeList: document.getElementById("recipeList"),
        recipeDetail: document.getElementById("recipeDetail"),
        statusText: document.getElementById("status")
    };
}


// ===================================
// SEARCH FOOD
// ===================================

async function searchRecipes() {

    const {
        searchInput,
        searchBtn,
        recipeList,
        recipeDetail,
        statusText
    } = getElements();

    const query = searchInput.value.trim();

    if (!query) {
        statusText.textContent = "Please enter a food name!";
        return;
    }

    statusText.textContent = "Searching recipes... Please wait.";
    recipeList.innerHTML = "";
    recipeDetail.innerHTML = "";
    searchBtn.disabled = true;

    try {

        const requests = [
            fetch(
                `${API.mealDB}/search.php?s=${encodeURIComponent(query)}`
            ).then(response => {
                if (!response.ok) {
                    throw new Error("TheMealDB connection failed");
                }
                return response.json();
            })
        ];

        // Edamam hanya digunakan jika API keys telah dimasukkan.
        const hasEdamamKey =
            EDAMAM_APP_ID.trim() !== "" &&
            EDAMAM_APP_KEY.trim() !== "";

        if (hasEdamamKey) {

            const edamamUrl =
                `${API.edamam}?type=public&q=${encodeURIComponent(query)}` +
                `&app_id=${encodeURIComponent(EDAMAM_APP_ID)}` +
                `&app_key=${encodeURIComponent(EDAMAM_APP_KEY)}`;

            requests.push(
                fetch(edamamUrl).then(response => {
                    if (!response.ok) {
                        throw new Error("Edamam connection failed");
                    }
                    return response.json();
                })
            );
        }

        const results = await Promise.allSettled(requests);

        recipes = [];

        // TheMealDB results
        if (results[0].status === "fulfilled") {

            const meals = results[0].value.meals || [];

            meals.forEach(meal => {
                recipes.push({
                    id: meal.idMeal,
                    name: meal.strMeal,
                    image: meal.strMealThumb,
                    source: "TheMealDB",
                    category: meal.strCategory || "Recipe",
                    area: meal.strArea || "Unknown",
                    instructions: meal.strInstructions ||
                        "No instructions available."
                });
            });

        } else {
            console.error("TheMealDB error:", results[0].reason);
        }

        // Edamam results
        if (hasEdamamKey && results[1]?.status === "fulfilled") {

            const hits = results[1].value.hits || [];

            hits.forEach(hit => {

                const recipe = hit.recipe;

                recipes.push({
                    id: recipe.uri,
                    name: recipe.label,
                    image: recipe.image,
                    source: "Edamam",
                    category: recipe.dishType?.[0] || "Recipe",
                    area: recipe.cuisineType?.[0] || "Various",
                    ingredients: recipe.ingredientLines || [],
                    instructions: recipe.url
                });

            });

        } else if (hasEdamamKey && results[1]?.status === "rejected") {
            console.error("Edamam error:", results[1].reason);
        }

        if (recipes.length === 0) {
            statusText.textContent =
                "No recipes found. Try Chicken, Pasta or Cake.";
            return;
        }

        statusText.textContent =
            `Found ${recipes.length} recipes!`;

        displayRecipes(recipes);

    } catch (error) {

        console.error("Search error:", error);

        statusText.textContent =
            "Unable to search recipes. Please check your internet connection.";

    } finally {
        searchBtn.disabled = false;
    }
}


// ===================================
// SEARCH BY CUISINE
// ===================================

async function searchCuisine(area) {

    const {
        recipeList,
        recipeDetail,
        statusText
    } = getElements();

    statusText.textContent = `Searching ${area} recipes...`;
    recipeList.innerHTML = "";
    recipeDetail.innerHTML = "";

    try {

        const response = await fetch(
            `${API.mealDB}/filter.php?a=${encodeURIComponent(area)}`
        );

        if (!response.ok) {
            throw new Error("Cuisine API connection failed");
        }

        const data = await response.json();
        const meals = data.meals || [];

        if (meals.length === 0) {
            statusText.textContent =
                `Sorry, no ${area} recipes found in the database.`;
            return;
        }

        const selectedMeals = meals.slice(0, 9);

        const detailResults = await Promise.all(
            selectedMeals.map(async meal => {

                const detailResponse = await fetch(
                    `${API.mealDB}/lookup.php?i=${meal.idMeal}`
                );

                if (!detailResponse.ok) {
                    return null;
                }

                const detailData = await detailResponse.json();

                return detailData.meals
                    ? detailData.meals[0]
                    : null;
            })
        );

        recipes = detailResults
            .filter(meal => meal !== null)
            .map(meal => ({
                id: meal.idMeal,
                name: meal.strMeal,
                image: meal.strMealThumb,
                source: "TheMealDB",
                category: meal.strCategory || "Recipe",
                area: meal.strArea || area,
                instructions: meal.strInstructions ||
                    "No instructions available."
            }));

        if (recipes.length === 0) {
            statusText.textContent = "No recipes found.";
            return;
        }

        statusText.textContent =
            `Found ${recipes.length} ${area} recipes!`;

        displayRecipes(recipes);

        recipeList.scrollIntoView({
            behavior: "smooth"
        });

    } catch (error) {

        console.error("Cuisine search error:", error);

        statusText.textContent =
            "Unable to load cuisine recipes. Please try again.";

    }
}


// ===================================
// SEARCH COCKTAILS
// ===================================

async function searchCocktails() {

    const {
        searchInput,
        recipeList,
        recipeDetail,
        statusText
    } = getElements();

    const query = searchInput.value.trim();

    statusText.textContent = "Searching cocktail recipes...";
    recipeList.innerHTML = "";
    recipeDetail.innerHTML = "";

    try {

        let url;

        if (query) {
            // Jika pengguna taip nama cocktail
            url = `${API.cocktailDB}/search.php?s=${encodeURIComponent(query)}`;
        } else {
            // Jika ruang search kosong, paparkan senarai cocktail
            url = `${API.cocktailDB}/filter.php?c=Cocktail`;
        }

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Cocktail API connection failed");
        }

        const data = await response.json();
        const drinks = data.drinks || [];

        if (drinks.length === 0) {
            statusText.textContent =
                "No cocktail recipes found. Try Margarita or Mojito.";
            return;
        }

        recipes = drinks.map(drink => ({
            id: drink.idDrink,
            name: drink.strDrink,
            image: drink.strDrinkThumb,
            source: "CocktailDB",
            category: drink.strCategory || "Cocktail",
            area: drink.strAlcoholic || "Unknown",
            instructions: drink.strInstructions || "",
            ingredients: []
        }));

        statusText.textContent =
            `Found ${recipes.length} cocktail recipes!`;

        displayRecipes(recipes);

        recipeList.scrollIntoView({
            behavior: "smooth"
        });

    } catch (error) {

        console.error("Cocktail search error:", error);

        statusText.textContent =
            "Unable to load cocktails. Please check your internet connection.";

    }
}


// ===================================
// DISPLAY RECIPE CARDS
// ===================================

function displayRecipes(data) {

    const { recipeList } = getElements();

    recipeList.innerHTML = "";

    data.forEach((recipe, index) => {

        const card = document.createElement("div");
        card.className = "recipe-card";

        const image = document.createElement("img");
        image.src = recipe.image || "";
        image.alt = recipe.name;
        image.loading = "lazy";

        const title = document.createElement("h3");
        title.textContent = recipe.name;

        const source = document.createElement("p");
        source.textContent = `Source: ${recipe.source}`;

        const button = document.createElement("button");
        button.textContent = "View Recipe";

        button.addEventListener("click", function () {
            showDetails(index);
        });

        card.append(image, title, source, button);

        recipeList.appendChild(card);

    });
}


// ===================================
// SHOW RECIPE DETAILS
// ===================================

async function showDetails(index) {

    const {
        recipeDetail,
        statusText
    } = getElements();

    const recipe = recipes[index];

    if (!recipe) return;

    recipeDetail.innerHTML = "";

    const title = document.createElement("h2");
    title.textContent = recipe.name;

    const image = document.createElement("img");
    image.src = recipe.image || "";
    image.alt = recipe.name;

    const category = document.createElement("p");
    category.textContent = `Category: ${recipe.category}`;

    const area = document.createElement("p");
    area.textContent = `Type / Area: ${recipe.area}`;

    recipeDetail.append(title, image, category, area);

    // TheMealDB
    if (recipe.source === "TheMealDB") {

        const heading = document.createElement("h3");
        heading.textContent = "Cooking Instructions";

        const instructions = document.createElement("p");
        instructions.textContent = recipe.instructions;

        recipeDetail.append(heading, instructions);

    }

    // Edamam
    else if (recipe.source === "Edamam") {

        const heading = document.createElement("h3");
        heading.textContent = "Ingredients";

        const ingredients = document.createElement("p");
        ingredients.textContent = recipe.ingredients.join("\n");

        const link = document.createElement("a");
        link.href = recipe.instructions;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "View Full Cooking Instructions";

        recipeDetail.append(heading, ingredients, link);

    }

    // CocktailDB
    else if (recipe.source === "CocktailDB") {

        statusText.textContent = "Loading cocktail details...";

        try {

            const response = await fetch(
                `${API.cocktailDB}/lookup.php?i=${recipe.id}`
            );

            if (!response.ok) {
                throw new Error("Unable to load cocktail details");
            }

            const data = await response.json();
            const drink = data.drinks?.[0];

            if (!drink) {
                throw new Error("Cocktail details not found");
            }

            const heading = document.createElement("h3");
            heading.textContent = "Ingredients";

            const ingredients = document.createElement("p");

            const ingredientLines = [];

            for (let i = 1; i <= 15; i++) {

                const ingredient = drink[`strIngredient${i}`];
                const measure = drink[`strMeasure${i}`];

                if (ingredient && ingredient.trim()) {
                    ingredientLines.push(
                        `${measure ? measure.trim() : ""} ${ingredient}`.trim()
                    );
                }
            }

            ingredients.textContent =
                ingredientLines.join("\n") || "No ingredients available.";

            const instructionHeading = document.createElement("h3");
            instructionHeading.textContent = "Instructions";

            const instructions = document.createElement("p");
            instructions.textContent =
                drink.strInstructions || "No instructions available.";

            recipeDetail.append(
                heading,
                ingredients,
                instructionHeading,
                instructions
            );

            statusText.textContent = "Cocktail details loaded!";

        } catch (error) {

            console.error("Cocktail details error:", error);

            statusText.textContent =
                "Unable to load cocktail details.";
        }
    }

    recipeDetail.scrollIntoView({
        behavior: "smooth"
    });
}


// ===================================
// OPENING HOURS
// ===================================

function checkOpeningHours() {

    const now = new Date();

    const currentTime =
        now.getHours() * 60 + now.getMinutes();

    const openingTime = 8 * 60;
    const closingTime = 22 * 60;

    const status = document.getElementById("openStatus");

    if (!status) return;

    if (
        currentTime >= openingTime &&
        currentTime < closingTime
    ) {
        status.textContent = "🟢 NOW OPEN";
    } else {
        status.textContent = "🔴 NOW CLOSED";
    }
}

