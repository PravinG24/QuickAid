import azure.functions as func

from get_ticket import main as get_ticket_main


def main(req: func.HttpRequest) -> func.HttpResponse:
	return get_ticket_main(req)
