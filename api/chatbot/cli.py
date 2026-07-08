from chatbot import Disaster
from dotenv import load_dotenv
load_dotenv()

BANNER = """\
==========================================================================
                 Natural-hazard & disaster science expert
         fire  .  flood  .  earthquake  .  landslide  .  wildfire
==========================================================================
     !!  In an emergency, call your local emergency number FIRST  !!
 v1.0  .  educational guidance - not a substitute for emergency services
==========================================================================
"""


def main():
    try:
        bot =Disaster()
    except Exception as ex:
        print(f"Failed to start: error -> {ex}")
        print("Set API_KEY and install requirements.") # gemini api key need
        return 1
    print(BANNER)
    while True:
        try:
            user = input("\nyou -> ").strip()
        except (EOFError,KeyboardInterrupt):
            print("\nbye")
            return 0
        if not user:
            continue
        if user == "/exit":
            print("bye")
            return 0
        if user == "/reset":
            bot.reset()
            print("Conversation reset")
            continue
        print("\nbot > ",end = "",flush = True)
        try:
            for chunk in bot.stream(user):
                print(chunk,end="",flush=True)
            print()
        except Exception as exe:
            print(f"\n[error] as {exe}")

if __name__ == "__main__":
    raise SystemExit(main())