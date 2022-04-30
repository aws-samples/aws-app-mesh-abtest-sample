#
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
#
# Permission is hereby granted, free of charge, to any person obtaining a copy of this
# software and associated documentation files (the "Software"), to deal in the Software
# without restriction, including without limitation the rights to use, copy, modify,
# merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
# permit persons to whom the Software is furnished to do so.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
# INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
# PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
# HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
# OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
# SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
#

import random
from bs4 import BeautifulSoup
from locust import HttpLocust, TaskSet, task, between


def is_static_file(f):
    if "/images" in f:
        return True
    else:
        return False

def fetch_static_assets(session, response):
    resource_urls = set()
    soup = BeautifulSoup(response.text, "html.parser")

    for res in soup.find_all(src=True):
        url = res['src']
        if is_static_file(url):
            resource_urls.add(url)
        
    for url in resource_urls:
        session.client.get(url)

class UserBehavior(TaskSet):

    def on_start(self):
        self.products = [
            "0983976883313",
            "1051094507639",
            "3103748076140",
            "3377807835348",
            "3480077496703",
            "4618701513994",
            "5147991444866",
            "6392888360364",
            "6464865908071",
            "0000000000000", # dummy id
        ]
        self.versions = ["v2a", "v2b", "v2b"] # Add an additional v2b to favor this version over v2a
        self.client.headers = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.55 Safari/537.36 (LocustIO)"}

    @task(2)
    def index(self):
        response = self.client.get("/")
        fetch_static_assets(self, response)

    @task(1)
    def browseProduct(self):
        response = self.client.get("/product/" + random.choice(self.products))
        fetch_static_assets(self, response)

    @task
    def viewCart(self):
        self.client.get("/cart")

    @task
    def addToCart(self):
        product = random.choice(self.products)
        oneclick = bool(random.getrandbits(1))

        self.client.get("/product/" + product)
        self.client.post("/cart", {
            'product_id': product,
            'type': 'oneclick' if oneclick else ''
        }, cookies={"app_version": random.choice(self.versions) if oneclick else 'v1'})

    @task
    def checkout(self):
        self.addToCart();

        self.client.post("/cart/checkout", {
            'name': 'Demo User',
            'email': 'demo-user@example.com',
            'address': '123 Road',
            'zip': '80807',
            'city': 'Munich',
            'state': 'BY',
            'country': 'Germany',
            'paymentMethod': 'AmazonPay'
        })

        self.client.get('/cart/checkout')

        self.client.post("/cart/order")

        self.client.get("/cart/order")


class WebsiteUser(HttpLocust):
    task_set = UserBehavior
    wait_time = between(2, 10)
