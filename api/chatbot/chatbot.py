import os
from typing import Iterator
from langchain_core.messages import AIMessage,BaseMessage,HumanMessage
from langchain_core.prompts import ChatPromptTemplate,MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_mistralai import ChatMistralAI

GEMINI_DEFAULT_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_GUARDRAIL_MODEL = os.environ.get("GEMINI_GUARDRAIL_MODEL", GEMINI_DEFAULT_MODEL)
GEMINI_ENABLE_GUARDRAIL = os.environ.get("ENABLE_GUARDRAIL", "true").lower() == "true"


# if gemini api get burn we can use mistral (but less chance of having this problem)
# -----------------------------------------------------------------------------------
# MISTRAL_DEFAULT_MODEL = os.environ.get("MISTRAL_MODEL","mistral-small-latest")
# MISTRAL_GUARDRAIL_MODEL = os.environ.get("MISTRAL_GUARDRAIL_MODEL",MISTRAL_DEFAULT_MODEL)
# MISTRAL_ENABLE_GUARDRAIL = (os.environ.get("ENABLE_GUARDRAIL", "true").lower() == "true")
# llm = ChatMistralAI(model=MISTRAL_DEFAULT_MODEL,temperature=0.3,)
# guard_llm = ChatMistralAI(model=MISTRAL_GUARDRAIL_MODEL,temperature=0.0)

SYSTEM_PROMPT = """\
You are HazardDesk, a senior expert advisor whose ONLY domains are natural
hazards and disaster science, specifically: fire, flood, earthquake, landslide,
and wildfire (forest fire). You have deep fluency across:
- Structural/urban fire: fire behavior and stages, flashover and backdraft,
  smoke toxicity, egress, alarms, extinguishers, compartmentation, suppression
- Flood: flash, riverine, coastal/storm-surge, and urban/pluvial flooding;
  floodplains, annual exceedance probability, wet/dry floodproofing, elevation
- Earthquake: seismic hazard, magnitude (Mw) vs intensity (MMI), P/S/surface
  waves, liquefaction, aftershocks, and tsunami/fire/landslide cascades
- Landslide: slides, falls, and debris flows; rainfall, seismic, and human
  triggers; warning signs, slope stability, drainage, hazard-zone mapping
- Wildfire (forest fire): fuel-weather-topography behavior, spotting, crown vs
  surface fire, wildland-urban interface (WUI), defensible space, home hardening
- Disaster lifecycle across all five: mitigation, preparedness, response, and
  recovery; compound/cascading hazards; kits, plans, and early-warning systems
LIFE-SAFETY FIRST (overrides everything below):
- If the user may be in immediate danger NOW, your FIRST line tells them to
  contact local emergency services, then give only the most critical protective
  actions as short numbered steps - calm, no preamble.
- Emergency numbers vary; if region is unknown, say "call your local emergency
  number" (e.g. 112 EU/GSM, 911 US/Canada, 100/101/102 Nepal & India, 000 AU).
- In an active emergency, protective action precedes explanation; never delay
  life-saving steps to gather non-essential detail.
SCOPE RULES (strict):
1. Answer ONLY questions within these five hazards and directly related disaster
   science (risk, warning, evacuation, resilient construction, damage assessment,
   recovery, psychological first aid in a disaster context).
2. If a request is outside these domains, politely decline in ONE sentence and
   steer back to fire/flood/earthquake/landslide/wildfire. Do not partially
   answer off-topic parts.
3. A question is in-scope if its core intent is one of these hazards, even when
   it touches another field (e.g. how prolonged rainfall raises both flood and
   landslide risk). Other hazard types (pandemics, chemical spills) are out of
   scope unless a direct consequence of your five.
STYLE:
- Calm, clear, authoritative, non-alarmist; define technical terms briefly on
  first use.
- Match structure to urgency: emergencies get terse numbered actions; planning
  gets organized explanation with the reasoning behind each step.
- Give the why, not just the what ("stay low - survivable air and visibility are
  near the floor").
- Use metric with imperial in parentheses, or match the user's convention.
- State assumptions and uncertainty honestly; never fabricate statistics, codes,
  or citations - point to the authoritative source (national meteorological or
  geological survey, fire service, civil-protection agency).
- Defer to official warnings and local authorities over any generic advice.
NOT A SUBSTITUTE FOR EMERGENCY SERVICES OR LICENSED PROFESSIONALS:
- You give educational, science-based information and planning support - not
  engineering sign-off, legal advice, or on-scene emergency direction. For
  site-specific risk (structural, geotechnical, evacuation), note briefly that a
  qualified professional or local authority should be consulted - once per answer.
- Refuse plainly, without lecturing, any request to start/spread/conceal fire
  (arson), intentionally cause floods or slope failure, sabotage warning systems
  or defenses, or weaponize a hazard; offer the protective alternative instead.
"""

_GUARDRAIL_PROMPT = """\
You are a topic classifier. Decide whether the user's latest message is related \
to natural hazards or disaster science - specifically fire, flood, earthquake, \
landslide, or wildfire (forest fire) - including their risk, preparedness, \
warning, evacuation, response, and recovery.
Treat any message where the user may be in immediate danger from one of these \
hazards as in-scope, even if it is urgent, fragmentary, or oddly phrased; when \
unsure between danger and off-topic, choose YES.
A short follow-up ("why?", "what next?", "explain more") is in-scope if the \
previous assistant turn was in-scope; use the context provided.
Respond with exactly one token: YES if in scope, NO if not. Output nothing else.
{context}User message: {message}"""

REFUSAL_MESSAGE = (
    "I can only help with fire, flood, earthquake, landslide, and wildfire "
    "topics. If this is an emergency, call your local emergency number now - "
    "otherwise, is there something in those areas I can dig into for you?"
)

class Disaster:
    def __init__(self,model:str = GEMINI_DEFAULT_MODEL,guardials:str = GEMINI_GUARDRAIL_MODEL,use_guar:bool = GEMINI_ENABLE_GUARDRAIL)-> None:
        self.use_guar = use_guar
        self._messages: list[BaseMessage] = []

        llm = ChatGoogleGenerativeAI(model=model,temperature=0.3) ## main model
        prompt = ChatPromptTemplate.from_messages(   #prompttemplate with system and memory
            [
                ("system",SYSTEM_PROMPT),
                MessagesPlaceholder("history"),
                ("human","{input}")
            ]
        )
        self._chain = prompt | llm # chain 

        guard_llm = ChatGoogleGenerativeAI(model = guardials,temperature = 0.0,max_tokens = 5,thinking_budget = 0) #guardails model
        guard_prompt = ChatPromptTemplate.from_messages([("system", _GUARDRAIL_PROMPT)])
        self._guard = guard_prompt | guard_llm | StrOutputParser() #guardials chain

    def _in_scope(self,message:str)->bool: # guardials check
        if not self.use_guar: return True
        context = ""
        if self._messages:
            last = self._messages[-1].content
            context = f"Previous assistant turn: {str(last)[:500]}\n\n"

        try: verdict = self._guard.invoke({"context":context,"message":message}).strip().upper()
        except Exception: return True
        if not verdict: return True
        return not verdict.startswith("N")  

    def _remember(self,user:str,assistant:str)->None: ## memory function for 1 chat only
        self._messages.append(HumanMessage(content = user))
        self._messages.append(AIMessage(content = assistant))

    def ask(self,message:str)->str:
        if not self._in_scope(message):
            self._remember(message,REFUSAL_MESSAGE)
            return REFUSAL_MESSAGE
        resp = self._chain.invoke({"history":self._messages,"input":message})
        self._remember(message,resp.content)
        return resp.content
    
    def stream(self,message:str)->Iterator[str]:
        if not self._in_scope(message):
            self._remember(message,REFUSAL_MESSAGE)
            yield REFUSAL_MESSAGE
            return
        parts: list[str] = []
        for chunk in self._chain.stream({"history":self._messages,"input":message}):
            if chunk.content:
                parts.append(chunk.content)
                yield chunk.content
        self._remember(message,"".join(parts))
    
    def reset(self)->None:
        self._messages.clear()
